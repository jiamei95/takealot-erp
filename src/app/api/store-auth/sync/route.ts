import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

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

interface SyncResult {
  success: boolean;
  store_name: string;
  sync_time: string;
  synced_data: { products_synced: number; orders_synced: number };
  errors: string[];
  message: string;
  debug?: { url: string; status: number; body: string }[];
}

function buildHeaders(auth: { api_key: string }) {
  return {
    'Authorization': `Bearer ${auth.api_key}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
}

// 尝试获取数据，返回详细调试信息
async function tryFetchData(
  baseUrl: string,
  endpoint: string,
  headers: Record<string, string>,
): Promise<{ ok: boolean; status: number; body: string; data: unknown }> {
  const url = `${baseUrl}${endpoint}`;
  try {
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(15000),
    });
    const text = await response.text();
    let data: unknown = null;
    try { data = JSON.parse(text); } catch { data = text; }
    return { ok: response.ok, status: response.status, body: text.slice(0, 1000), data };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { ok: false, status: 0, body: msg, data: null };
  }
}

// 从 API 响应中提取数组数据
function extractArray(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    for (const key of ['rows', 'data', 'products', 'orders', 'results', 'items', 'records', 'list']) {
      if (Array.isArray(obj[key])) return obj[key] as unknown[];
    }
    // Try nested: { data: { rows: [...] } }
    if (obj.data && typeof obj.data === 'object') {
      const nested = obj.data as Record<string, unknown>;
      for (const key of ['rows', 'items', 'records', 'list']) {
        if (Array.isArray(nested[key])) return nested[key] as unknown[];
      }
    }
  }
  return [];
}

// 标准化产品数据
function normalizeProduct(raw: Record<string, unknown>): TakealotProduct | null {
  const sku = String(raw.sku || raw.product_sku || raw.Sku || raw.productSku || '');
  if (!sku) return null;
  return {
    sku,
    title: String(raw.title || raw.name || raw.product_name || raw.productName || sku),
    selling_price: Number(raw.selling_price || raw.price || raw.listPrice || raw.retail_price || 0),
    cost_price: Number(raw.cost_price || raw.cost || raw.costPrice || 0),
    image_url: String(raw.image_url || raw.imageUrl || raw.image || ''),
    product_id: String(raw.product_id || raw.productId || raw.id || ''),
  };
}

// 标准化订单数据
function normalizeOrder(raw: Record<string, unknown>): TakealotOrder | null {
  const orderNumber = String(raw.order_number || raw.orderNumber || raw.order_id || raw.id || '');
  if (!orderNumber) return null;
  return {
    order_number: orderNumber,
    order_date: String(raw.order_date || raw.orderDate || raw.created_at || raw.date || ''),
    product_sku: String(raw.product_sku || raw.sku || raw.productSku || ''),
    quantity: Number(raw.quantity || raw.qty || 1),
    selling_price: Number(raw.selling_price || raw.price || raw.amount || 0),
    cost_price: Number(raw.cost_price || raw.cost || raw.costPrice || 0),
    platform_commission: Number(raw.platform_commission || raw.commission || 0),
    payment_fee: Number(raw.payment_fee || raw.paymentFee || 0),
    storage_fee: Number(raw.storage_fee || raw.storageFee || 0),
    other_fees: Number(raw.other_fees || raw.otherFees || 0),
    status: String(raw.status || 'completed'),
  };
}

function upsertProducts(products: TakealotProduct[], storeName: string) {
  const db = getDb();
  const existingStore = db.prepare('SELECT id FROM stores WHERE name = ?').get(storeName) as { id: number } | undefined;
  if (!existingStore) {
    db.prepare("INSERT INTO stores (name, created_at) VALUES (?, datetime('now'))").run(storeName);
  }

  const stmt = db.prepare(`
    INSERT INTO products (sku, name, cost_price, selling_price, image_url, takealot_product_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    ON CONFLICT(sku) DO UPDATE SET
      name = excluded.name, cost_price = excluded.cost_price, selling_price = excluded.selling_price,
      image_url = excluded.image_url, takealot_product_id = excluded.takealot_product_id, updated_at = datetime('now')
  `);

  let count = 0;
  for (const p of products) {
    stmt.run(p.sku, p.title, p.cost_price, p.selling_price, p.image_url, p.product_id);
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
      quantity = excluded.quantity, selling_price = excluded.selling_price, status = excluded.status
  `);

  let count = 0;
  for (const o of orders) {
    const product = db.prepare('SELECT id FROM products WHERE sku = ?').get(o.product_sku) as { id: number } | undefined;
    if (!product) continue;
    const profit = (o.selling_price * o.quantity) - (o.cost_price * o.quantity) - o.platform_commission - o.payment_fee - o.storage_fee - o.other_fees;
    stmt.run(o.order_number, o.order_date, product.id, o.quantity, o.selling_price, o.cost_price,
      o.platform_commission, o.payment_fee, o.storage_fee, o.other_fees, profit, o.status, storeName);
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
      id: number; store_name: string; api_key: string; api_base_url?: string;
    } | undefined;

    if (!auth) {
      return NextResponse.json({ error: '未找到该店铺授权信息' }, { status: 404 });
    }
    if (!auth.api_key) {
      return NextResponse.json({ error: 'API Key 未配置，请先编辑授权信息' }, { status: 400 });
    }

    const baseUrl = auth.api_base_url || 'https://seller-api.takealot.com';
    const headers = buildHeaders(auth);
    const debugLog: { url: string; status: number; body: string }[] = [];

    // 尝试多个端点
    const productEndpoints = [
      '/restful-1.0.0/seller/products',
      '/v1/products', '/v1/seller/products',
      '/api/products', '/api/seller/products',
      '/products', '/seller/products',
    ];
    const orderEndpoints = [
      '/restful-1.0.0/seller/orders',
      '/v1/orders', '/v1/seller/orders',
      '/api/orders', '/api/seller/orders',
      '/orders', '/seller/orders',
    ];

    let products: TakealotProduct[] = [];
    let orders: TakealotOrder[] = [];
    const errors: string[] = [];

    // 获取产品
    for (const endpoint of productEndpoints) {
      const result = await tryFetchData(baseUrl, endpoint, headers);
      debugLog.push({ url: `${baseUrl}${endpoint}`, status: result.status, body: result.body });
      if (result.ok) {
        const arr = extractArray(result.data);
        products = arr.map(r => normalizeProduct(r as Record<string, unknown>)).filter(Boolean) as TakealotProduct[];
        if (products.length > 0 || arr.length === 0) break; // 成功获取（可能确实没有产品）
      }
    }
    if (products.length === 0 && debugLog.every(d => d.status !== 200)) {
      errors.push('产品同步失败: 所有端点返回错误');
    }

    // 获取订单
    for (const endpoint of orderEndpoints) {
      const result = await tryFetchData(baseUrl, endpoint, headers);
      debugLog.push({ url: `${baseUrl}${endpoint}`, status: result.status, body: result.body });
      if (result.ok) {
        const arr = extractArray(result.data);
        orders = arr.map(r => normalizeOrder(r as Record<string, unknown>)).filter(Boolean) as TakealotOrder[];
        if (orders.length > 0 || arr.length === 0) break;
      }
    }
    if (orders.length === 0 && debugLog.filter(d => d.url.includes('order')).every(d => d.status !== 200)) {
      errors.push('订单同步失败: 所有端点返回错误');
    }

    // 保存数据
    const productsSynced = products.length > 0 ? upsertProducts(products, auth.store_name) : 0;
    const ordersSynced = orders.length > 0 ? upsertOrders(orders, auth.store_name) : 0;

    // 更新同步时间
    db.prepare("UPDATE store_auth SET last_sync_at = datetime('now'), auth_status = ? WHERE id = ?")
      .run(errors.length > 0 ? 'error' : 'connected', auth.id);

    const result: SyncResult = {
      success: errors.length === 0,
      store_name: auth.store_name,
      sync_time: new Date().toISOString(),
      synced_data: { products_synced: productsSynced, orders_synced: ordersSynced },
      errors,
      message: errors.length === 0
        ? `同步成功！获取了 ${productsSynced} 个产品和 ${ordersSynced} 个订单。`
        : `同步部分完成：${productsSynced} 个产品，${ordersSynced} 个订单。${errors.join('; ')}`,
      debug: debugLog.slice(0, 10), // 最多返回 10 条调试信息
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json(
      { error: `同步失败: ${error instanceof Error ? error.message : '未知错误'}` },
      { status: 500 }
    );
  }
}
