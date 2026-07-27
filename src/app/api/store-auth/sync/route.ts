import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Takealot Seller API 配置
// 官方文档: https://seller-api.takealot.com
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

function buildHeaders(auth: { api_key: string }) {
  // Takealot Seller API 使用 API Key 进行认证
  return {
    'Authorization': `Bearer ${auth.api_key}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
}

// 尝试多个可能的 API 端点
const PRODUCT_ENDPOINTS = [
  '/restful-1.0.0/seller/products',
  '/v1/seller/products',
  '/rest/product-list',
];

const ORDER_ENDPOINTS = [
  '/restful-1.0.0/seller/orders',
  '/v1/seller/orders',
  '/rest/order-list',
];

async function tryFetch<T>(
  headers: Record<string, string>,
  endpoints: string[],
  label: string
): Promise<T[]> {
  for (const endpoint of endpoints) {
    const url = `${TAKEALOT_API_BASE}${endpoint}`;
    try {
      const response = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });

      if (response.status === 404) {
        console.log(`[${label}] Endpoint ${endpoint} not found, trying next...`);
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[${label}] ${endpoint} failed (${response.status}): ${errorText}`);
        continue;
      }

      const data = await response.json();
      console.log(`[${label}] Successfully fetched from ${endpoint}`);

      // Handle different response formats
      if (Array.isArray(data)) return data as T[];
      if (data.rows) return data.rows as T[];
      if (data.data) return data.data as T[];
      if (data.products) return data.products as T[];
      if (data.orders) return data.orders as T[];
      if (data.results) return data.results as T[];

      return [];
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.error(`[${label}] Request timeout for ${endpoint}`);
        continue;
      }
      console.error(`[${label}] Error fetching ${endpoint}:`, error);
      continue;
    }
  }

  throw new Error(`所有 ${label} API 端点均无法获取数据，请检查 API Key 是否正确`);
}

async function fetchProducts(headers: Record<string, string>): Promise<TakealotProduct[]> {
  return tryFetch<TakealotProduct>(headers, PRODUCT_ENDPOINTS, 'Products');
}

async function fetchOrders(headers: Record<string, string>): Promise<TakealotOrder[]> {
  return tryFetch<TakealotOrder>(headers, ORDER_ENDPOINTS, 'Orders');
}

function upsertProducts(products: TakealotProduct[], storeName: string) {
  const db = getDb();

  // Ensure store exists
  const existingStore = db.prepare('SELECT id FROM stores WHERE name = ?').get(storeName) as { id: number } | undefined;
  if (!existingStore) {
    db.prepare('INSERT INTO stores (name, created_at) VALUES (?, datetime("now"))').run(storeName);
  }

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

  const store = db.prepare('SELECT id FROM stores WHERE name = ?').get(storeName) as { id: number } | undefined;
  if (!store) return 0;

  const stmt = db.prepare(`
    INSERT INTO orders (order_number, order_date, product_id, quantity, selling_price, cost_price,
      platform_commission, payment_fee, storage_fee, other_fees, profit, status, store_name, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(order_number) DO UPDATE SET
      quantity = excluded.quantity,
      selling_price = excluded.selling_price,
      status = excluded.status
  `);

  let count = 0;
  for (const o of orders) {
    // Find product by SKU
    const product = db.prepare('SELECT id FROM products WHERE sku = ?').get(o.product_sku) as { id: number } | undefined;
    if (!product) continue;

    const profit = (o.selling_price * o.quantity) - (o.cost_price * o.quantity) - o.platform_commission - o.payment_fee - o.storage_fee - o.other_fees;

    stmt.run(
      o.order_number,
      o.order_date,
      product.id,
      o.quantity,
      o.selling_price,
      o.cost_price,
      o.platform_commission,
      o.payment_fee,
      o.storage_fee,
      o.other_fees,
      profit,
      o.status,
      storeName,
    );
    count++;
  }
  return count;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { store_id } = body;

    if (!store_id) {
      return NextResponse.json({ error: '缺少 store_id 参数' }, { status: 400 });
    }

    const db = getDb();
    const auth = db.prepare('SELECT * FROM store_auth WHERE id = ?').get(store_id) as {
      id: number;
      store_name: string;
      api_key: string;
      api_secret: string;
      access_token: string;
      auth_status: string;
    } | undefined;

    if (!auth) {
      return NextResponse.json({ error: '未找到该店铺授权信息' }, { status: 404 });
    }

    if (!auth.api_key) {
      return NextResponse.json({ error: 'API Key 未配置，请先编辑授权信息' }, { status: 400 });
    }

    const headers = buildHeaders(auth);

    // Fetch data from Takealot API
    let productsSynced = 0;
    let ordersSynced = 0;
    const errors: string[] = [];

    try {
      const products = await fetchProducts(headers);
      productsSynced = upsertProducts(products, auth.store_name);
    } catch (error) {
      errors.push(`产品同步失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }

    try {
      const orders = await fetchOrders(headers);
      ordersSynced = upsertOrders(orders, auth.store_name);
    } catch (error) {
      errors.push(`订单同步失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }

    // Update sync status
    const hasError = errors.length > 0;
    db.prepare(`
      UPDATE store_auth 
      SET auth_status = ?, last_sync_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?
    `).run(hasError ? 'error' : 'connected', auth.id);

    const syncTime = new Date().toISOString();

    return NextResponse.json({
      success: !hasError,
      store_name: auth.store_name,
      sync_time: syncTime,
      synced_data: {
        products_synced: productsSynced,
        orders_synced: ordersSynced,
      },
      errors: errors.length > 0 ? errors : undefined,
      message: hasError
        ? `同步部分完成：${productsSynced} 个产品，${ordersSynced} 个订单。${errors.join('; ')}`
        : `数据同步成功！同步了 ${productsSynced} 个产品和 ${ordersSynced} 个订单。`,
    });
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json(
      { error: `同步失败: ${error instanceof Error ? error.message : '未知错误'}` },
      { status: 500 }
    );
  }
}
