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

async function getAccessToken(apiKey: string, apiSecret: string): Promise<string> {
  const response = await fetch(`${TAKEALOT_API_BASE}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: apiKey,
      client_secret: apiSecret,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Takealot API 认证失败 (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function fetchProducts(accessToken: string): Promise<TakealotProduct[]> {
  const response = await fetch(`${TAKEALOT_API_BASE}/v1/products`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`获取产品列表失败 (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.products || data.data || [];
}

async function fetchOrders(accessToken: string): Promise<TakealotOrder[]> {
  const response = await fetch(`${TAKEALOT_API_BASE}/v1/orders`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`获取订单列表失败 (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.orders || data.data || [];
}

export async function POST(request: Request) {
  const db = getDb();
  const body = await request.json();
  const { store_id } = body;

  if (!store_id) {
    return NextResponse.json(
      { error: '店铺 ID 为必填项' },
      { status: 400 }
    );
  }

  const storeAuth = db
    .prepare('SELECT * FROM store_auth WHERE id = ?')
    .get(store_id) as Record<string, string> | undefined;

  if (!storeAuth) {
    return NextResponse.json(
      { error: '店铺授权记录不存在' },
      { status: 404 }
    );
  }

  if (storeAuth.auth_status !== 'connected') {
    return NextResponse.json(
      { error: '店铺未授权，请先完成授权配置' },
      { status: 400 }
    );
  }

  const { api_key, api_secret, store_name } = storeAuth;

  if (!api_key || !api_secret) {
    return NextResponse.json(
      { error: 'API Key 或 API Secret 未配置，请先编辑授权信息' },
      { status: 400 }
    );
  }

  const syncTime = new Date().toISOString().replace('T', ' ').substring(0, 19);
  let productsSynced = 0;
  let ordersSynced = 0;

  try {
    // Step 1: Get access token from Takealot
    const accessToken = await getAccessToken(api_key, api_secret);

    // Update access token in DB
    db.prepare(`
      UPDATE store_auth 
      SET access_token = ?, token_expires_at = datetime('now', '+1 hour'), updated_at = datetime('now')
      WHERE id = ?
    `).run(accessToken, store_id);

    // Step 2: Sync products
    const products = await fetchProducts(accessToken);
    const upsertProduct = db.prepare(`
      INSERT INTO products (sku, name, cost_price, selling_price, image_url, takealot_product_id)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(sku) DO UPDATE SET
        name = excluded.name,
        cost_price = excluded.cost_price,
        selling_price = excluded.selling_price,
        image_url = excluded.image_url,
        takealot_product_id = excluded.takealot_product_id,
        updated_at = datetime('now')
    `);

    for (const p of products) {
      upsertProduct.run(
        p.sku || '',
        p.title || p.sku || '',
        p.cost_price || 0,
        p.selling_price || 0,
        p.image_url || '',
        p.product_id || ''
      );
      productsSynced++;
    }

    // Step 3: Sync orders
    const orders = await fetchOrders(accessToken);
    const upsertOrder = db.prepare(`
      INSERT INTO orders (order_number, order_date, product_id, quantity, selling_price, cost_price,
        platform_commission, payment_fee, storage_fee, other_fees, profit, status, store_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(order_number) DO UPDATE SET
        status = excluded.status,
        selling_price = excluded.selling_price,
        quantity = excluded.quantity
    `);

    for (const o of orders) {
      const product = db.prepare('SELECT id FROM products WHERE sku = ?').get(o.product_sku) as { id: number } | undefined;
      const productId = product?.id || 0;
      const revenue = o.selling_price * o.quantity;
      const cost = (o.cost_price || 0) * o.quantity;
      const profit = revenue - cost - (o.platform_commission || 0) - (o.payment_fee || 0) - (o.storage_fee || 0) - (o.other_fees || 0);

      upsertOrder.run(
        o.order_number,
        o.order_date,
        productId,
        o.quantity,
        o.selling_price,
        o.cost_price || 0,
        o.platform_commission || 0,
        o.payment_fee || 0,
        o.storage_fee || 0,
        o.other_fees || 0,
        +profit.toFixed(2),
        o.status || 'completed',
        store_name
      );
      ordersSynced++;
    }

    // Step 4: Auto-create store record if not exists
    const existingStore = db.prepare('SELECT id FROM stores WHERE name = ?').get(store_name) as { id: number } | undefined;
    if (!existingStore) {
      db.prepare('INSERT INTO stores (name) VALUES (?)').run(store_name);
    }

    // Update sync time
    db.prepare(`UPDATE store_auth SET last_sync_at = ?, updated_at = datetime('now') WHERE id = ?`).run(
      syncTime,
      store_id
    );

    return NextResponse.json({
      success: true,
      store_name,
      sync_time: syncTime,
      synced_data: {
        products_synced: productsSynced,
        orders_synced: ordersSynced,
      },
      message: `数据同步成功！从 ${store_name} 同步了 ${productsSynced} 个产品和 ${ordersSynced} 个订单。`,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';

    // If auth fails, mark as disconnected
    if (errorMessage.includes('认证失败') || errorMessage.includes('401') || errorMessage.includes('403')) {
      db.prepare(`UPDATE store_auth SET auth_status = 'disconnected', updated_at = datetime('now') WHERE id = ?`).run(store_id);
    }

    return NextResponse.json(
      {
        error: `同步失败: ${errorMessage}`,
        store_name,
        sync_time: syncTime,
        synced_data: {
          products_synced: productsSynced,
          orders_synced: ordersSynced,
        },
      },
      { status: 500 }
    );
  }
}
