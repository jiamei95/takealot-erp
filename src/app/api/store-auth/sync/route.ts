import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

const TAKEALOT_API_BASE = 'https://seller-api.takealot.com';

interface TakealotProduct {
  sku: string;
  title: string;
  selling_price: number;
  cost_price?: number;
  image_url?: string;
  product_id?: string;
}

interface TakealotOrder {
  order_number: string;
  order_date: string;
  product_sku: string;
  quantity: number;
  selling_price: number;
  cost_price: number;
  platform_commission: number;
  payment_fee: number;
  storage_fee: number;
  other_fees: number;
  status: string;
}

function buildHeaders(auth: { api_key: string; api_secret: string; access_token: string }) {
  // Takealot 后台只提供 API Key，直接使用 API Key 作为 Bearer Token 认证
  return {
    'Authorization': `Bearer ${auth.api_key}`,
    'Content-Type': 'application/json',
  };
}

async function fetchProducts(headers: Record<string, string>): Promise<TakealotProduct[]> {
  const response = await fetch(`${TAKEALOT_API_BASE}/v1/products`, { headers });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`获取产品列表失败 (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : (data.products || data.data || []);
}

async function fetchOrders(headers: Record<string, string>): Promise<TakealotOrder[]> {
  const response = await fetch(`${TAKEALOT_API_BASE}/v1/orders`, { headers });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`获取订单列表失败 (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : (data.orders || data.data || []);
}

function upsertProducts(products: TakealotProduct[], storeName: string) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO products (sku, name, cost_price, selling_price, image_url, takealot_product_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    ON CONFLICT(sku) DO UPDATE SET
      name = excluded.name,
      cost_price = excluded.cost_price,
      selling_price = excluded.selling_price,
      image_url = excluded.image_url,
      takealot_product_id = excluded.takealot_product_id,
      updated_at = datetime('now')
  `);

  let count = 0;
  for (const p of products) {
    if (!p.sku) continue;
    stmt.run(
      p.sku,
      p.title || p.sku,
      p.cost_price || 0,
      p.selling_price || 0,
      p.image_url || '',
      p.product_id || '',
    );
    count++;
  }
  return count;
}

function upsertOrders(orders: TakealotOrder[], storeName: string) {
  const db = getDb();

  // Get store id
  const store = db.prepare('SELECT id FROM stores WHERE name = ?').get(storeName) as { id: number } | undefined;
  if (!store) return 0;

  const stmt = db.prepare(`
    INSERT INTO orders (order_number, order_date, product_id, quantity, selling_price, cost_price,
      platform_commission, payment_fee, storage_fee, other_fees, profit, status, store_name, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(order_number) DO UPDATE SET
      quantity = excluded.quantity,
      selling_price = excluded.selling_price,
      cost_price = excluded.cost_price,
      platform_commission = excluded.platform_commission,
      payment_fee = excluded.payment_fee,
      storage_fee = excluded.storage_fee,
      other_fees = excluded.other_fees,
      profit = excluded.profit,
      status = excluded.status
  `);

  let count = 0;
  for (const o of orders) {
    if (!o.order_number) continue;

    // Find product by SKU
    const product = db.prepare('SELECT id FROM products WHERE sku = ?').get(o.product_sku) as { id: number } | undefined;
    const productId = product?.id || null;

    const profit = (o.selling_price * o.quantity) - ((o.cost_price || 0) * o.quantity) -
      (o.platform_commission || 0) - (o.payment_fee || 0) - (o.storage_fee || 0) - (o.other_fees || 0);

    stmt.run(
      o.order_number,
      o.order_date,
      productId,
      o.quantity || 1,
      o.selling_price || 0,
      o.cost_price || 0,
      o.platform_commission || 0,
      o.payment_fee || 0,
      o.storage_fee || 0,
      o.other_fees || 0,
      profit,
      o.status || 'completed',
      storeName,
    );
    count++;
  }
  return count;
}

export async function POST(request: Request) {
  const db = getDb();
  const body = await request.json();
  const { store_id } = body;

  if (!store_id) {
    return NextResponse.json({ error: '缺少 store_id 参数' }, { status: 400 });
  }

  const auth = db.prepare('SELECT * FROM store_auth WHERE id = ?').get(store_id) as
    { id: number; store_name: string; api_key: string; api_secret: string; access_token: string } | undefined;

  if (!auth) {
    return NextResponse.json({ error: '未找到该店铺授权信息' }, { status: 404 });
  }

  // Takealot 只需要 API Key 进行认证
  if (!auth.api_key) {
    return NextResponse.json(
      { error: 'API Key 未配置，请先编辑授权信息' },
      { status: 400 }
    );
  }

  try {
    const headers = buildHeaders(auth);

    // Fetch data from Takealot API
    const [products, orders] = await Promise.all([
      fetchProducts(headers).catch((e) => {
        console.error('Failed to fetch products:', e.message);
        return [];
      }),
      fetchOrders(headers).catch((e) => {
        console.error('Failed to fetch orders:', e.message);
        return [];
      }),
    ]);

    // Upsert into database
    const productsSynced = upsertProducts(products, auth.store_name);
    const ordersSynced = upsertOrders(orders, auth.store_name);

    // Update sync time and status
    db.prepare(
      `UPDATE store_auth SET last_sync_at = datetime('now'), auth_status = 'connected', updated_at = datetime('now') WHERE id = ?`
    ).run(store_id);

    return NextResponse.json({
      success: true,
      store_name: auth.store_name,
      sync_time: new Date().toISOString(),
      synced_data: {
        products_synced: productsSynced,
        orders_synced: ordersSynced,
      },
      message: `数据同步成功！同步了 ${productsSynced} 个产品和 ${ordersSynced} 个订单。`,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';

    // If authentication fails, mark as disconnected
    if (errorMessage.includes('401') || errorMessage.includes('403')) {
      db.prepare(
        `UPDATE store_auth SET auth_status = 'disconnected', updated_at = datetime('now') WHERE id = ?`
      ).run(store_id);
      return NextResponse.json(
        { error: `认证失败，请检查 API 凭据是否正确。详细信息: ${errorMessage}` },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: `同步失败: ${errorMessage}` },
      { status: 500 }
    );
  }
}
