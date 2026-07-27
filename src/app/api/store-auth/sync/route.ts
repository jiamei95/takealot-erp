import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Takealot Marketplace API 数据模型
interface TakealotOffer {
  offer_id?: string;
  product_id?: string | number;
  sku?: string;
  seller_product_id?: string;
  title?: string;
  product_title?: string;
  name?: string;
  buying_price?: number;
  selling_price?: number;
  price?: number;
  inventory?: number;
  stock_quantity?: number;
  status?: string;
  [key: string]: unknown;
}

interface TakealotSale {
  sale_id?: string;
  order_id?: string | number;
  order_item_id?: string | number;
  sale_order_id?: string | number;
  product_id?: string | number;
  offer_id?: string;
  sku?: string;
  seller_product_id?: string;
  title?: string;
  product_title?: string;
  quantity?: number;
  selling_price?: number;
  price?: number;
  amount?: number;
  product_amount?: number;
  commission?: number;
  platform_fee?: number;
  status?: string;
  state?: string;
  order_status?: string;
  created_date?: string;
  order_date?: string;
  sale_date?: string;
  [key: string]: unknown;
}

interface TakealotTransaction {
  transaction_id?: string;
  sale_id?: string;
  order_id?: string | number;
  type?: string;
  description?: string;
  amount?: number;
  value?: number;
  created_date?: string;
  [key: string]: unknown;
}

interface SyncResult {
  success: boolean;
  store_name: string;
  sync_time: string;
  synced_data: {
    products_synced: number;
    orders_synced: number;
  };
  errors: string[];
  message: string;
  debug: Array<{ url: string; status: number; body: string }>;
}

// 构造请求头
function buildHeaders(apiKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  };
}

// 通用请求函数（带分页支持）
async function fetchAllPages<T>(
  baseUrl: string,
  endpoint: string,
  headers: Record<string, string>,
  debug: Array<{ url: string; status: number; body: string }>
): Promise<{ data: T[]; error: string | null }> {
  const allData: T[] = [];
  let continuationToken: string | null = null;
  let attempts = 0;
  const maxAttempts = 10; // 最多 10 页

  do {
    let url = `${baseUrl}${endpoint}`;
    if (continuationToken) {
      url += `?continuation_token=${encodeURIComponent(continuationToken)}`;
    }

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      const text = await response.text();
      debug.push({ url, status: response.status, body: text.slice(0, 500) });

      if (!response.ok) {
        return { data: [], error: `请求失败 (${response.status}): ${text.slice(0, 200)}` };
      }

      const json = JSON.parse(text);

      // Takealot API 可能返回 { results: [...] } 或直接 [...]
      const items: T[] = Array.isArray(json)
        ? json
        : json.results || json.data || json.items || json.offers || json.sales || [];

      allData.push(...items);

      // 检查分页游标
      continuationToken = json.continuation_token || json.next_token || null;
      attempts++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : '未知错误';
      return { data: [], error: `网络请求异常: ${msg}` };
    }
  } while (continuationToken && attempts < maxAttempts);

  return { data: allData, error: null };
}

// 同步产品（offers）
async function syncProducts(
  baseUrl: string,
  headers: Record<string, string>,
  storeName: string,
  debug: Array<{ url: string; status: number; body: string }>
): Promise<{ count: number; error: string | null }> {
  const result = await fetchAllPages<TakealotOffer>(baseUrl, '/offers', headers, debug);

  if (result.error) {
    return { count: 0, error: `产品同步失败: ${result.error}` };
  }

  const offers = result.data;
  if (offers.length === 0) {
    return { count: 0, error: '产品同步失败: /offers 返回数据为空' };
  }

  const db = getDb();
  let count = 0;

  for (const offer of offers) {
    const sku = offer.sku || offer.seller_product_id || offer.offer_id || '';
    const name = offer.title || offer.product_title || offer.name || '';
    const sellingPrice = offer.selling_price || offer.price || 0;

    if (!sku) continue;

    try {
      const existing = db.prepare('SELECT id FROM products WHERE sku = ?').get(sku) as { id: number } | undefined;

      if (existing) {
        db.prepare(
          'UPDATE products SET name = ?, selling_price = ?, updated_at = datetime(\'now\') WHERE id = ?'
        ).run(name, sellingPrice, existing.id);
      } else {
        db.prepare(
          'INSERT INTO products (sku, name, cost_price, selling_price, takealot_product_id, created_at, updated_at) VALUES (?, ?, 0, ?, ?, datetime(\'now\'), datetime(\'now\'))'
        ).run(sku, name, sellingPrice, offer.product_id?.toString() || offer.offer_id || '');
      }
      count++;
    } catch (err) {
      console.error(`Failed to sync product ${sku}:`, err);
    }
  }

  return { count, error: null };
}

// 同步订单（sales）
async function syncOrders(
  baseUrl: string,
  headers: Record<string, string>,
  storeName: string,
  debug: Array<{ url: string; status: number; body: string }>
): Promise<{ count: number; error: string | null }> {
  const result = await fetchAllPages<TakealotSale>(baseUrl, '/sales', headers, debug);

  if (result.error) {
    return { count: 0, error: `订单同步失败: ${result.error}` };
  }

  const sales = result.data;
  if (sales.length === 0) {
    return { count: 0, error: '订单同步失败: /sales 返回数据为空' };
  }

  const db = getDb();
  let count = 0;

  for (const sale of sales) {
    const orderId = sale.order_id?.toString() || sale.sale_order_id?.toString() || sale.sale_id || '';
    const sku = sale.sku || sale.seller_product_id || '';
    const quantity = sale.quantity || 1;
    const sellingPrice = sale.selling_price || sale.price || sale.amount || sale.product_amount || 0;
    const orderDate = sale.order_date || sale.sale_date || sale.created_date || new Date().toISOString().split('T')[0];
    const status = sale.status || sale.state || sale.order_status || 'completed';

    if (!orderId) continue;

    try {
      // 查找产品
      const product = sku
        ? db.prepare('SELECT id, cost_price FROM products WHERE sku = ?').get(sku) as { id: number; cost_price: number } | undefined
        : undefined;

      const productId = product?.id || null;
      const costPrice = product?.cost_price || 0;

      // 检查订单是否已存在
      const existing = db.prepare('SELECT id FROM orders WHERE order_number = ?').get(orderId) as { id: number } | undefined;

      if (existing) {
        db.prepare(
          `UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?`
        ).run(status, existing.id);
      } else {
        // 计算费用（Takealot 可能在 transactions 中提供，这里先用 0）
        const commission = sale.commission || 0;
        const paymentFee = 0;
        const storageFee = 0;
        const otherFees = sale.platform_fee || 0;
        const profit = sellingPrice * quantity - costPrice * quantity - commission - paymentFee - storageFee - otherFees;

        db.prepare(
          `INSERT INTO orders (order_number, order_date, product_id, quantity, selling_price, cost_price, platform_commission, payment_fee, storage_fee, other_fees, profit, status, store_name, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
        ).run(
          orderId,
          orderDate,
          productId,
          quantity,
          sellingPrice,
          costPrice,
          commission,
          paymentFee,
          storageFee,
          otherFees,
          profit,
          status,
          storeName
        );
      }
      count++;
    } catch (err) {
      console.error(`Failed to sync order ${orderId}:`, err);
    }
  }

  return { count, error: null };
}

// 同步交易明细（transactions）- 用于补充费用数据
async function syncTransactions(
  baseUrl: string,
  headers: Record<string, string>,
  debug: Array<{ url: string; status: number; body: string }>
): Promise<{ count: number; error: string | null }> {
  const result = await fetchAllPages<TakealotTransaction>(baseUrl, '/transactions', headers, debug);

  if (result.error) {
    return { count: 0, error: null }; // transactions 失败不影响整体同步
  }

  // TODO: 后续可以用 transactions 数据更新订单的费用明细
  return { count: result.data.length, error: null };
}

export async function POST(request: Request) {
  try {
    const { store_id } = await request.json();

    if (!store_id) {
      return NextResponse.json({ error: '缺少 store_id 参数' }, { status: 400 });
    }

    const db = getDb();
    const auth = db.prepare('SELECT * FROM store_auth WHERE id = ?').get(store_id) as {
      id: number;
      store_name: string;
      api_key: string;
      api_base_url: string;
      auth_status: string;
    } | undefined;

    if (!auth) {
      return NextResponse.json({ error: '未找到该店铺授权信息' }, { status: 404 });
    }

    if (!auth.api_key) {
      return NextResponse.json({ error: 'API Key 未配置，请先编辑授权信息' }, { status: 400 });
    }

    const baseUrl = auth.api_base_url || 'https://marketplace-api.takealot.com/v1';
    const headers = buildHeaders(auth.api_key);
    const debug: Array<{ url: string; status: number; body: string }> = [];

    // 并行同步产品和订单
    const [productResult, orderResult, transactionResult] = await Promise.all([
      syncProducts(baseUrl, headers, auth.store_name, debug),
      syncOrders(baseUrl, headers, auth.store_name, debug),
      syncTransactions(baseUrl, headers, debug),
    ]);

    const errors: string[] = [];
    if (productResult.error) errors.push(productResult.error);
    if (orderResult.error) errors.push(orderResult.error);

    // 更新同步时间
    db.prepare("UPDATE store_auth SET last_sync_at = datetime('now'), auth_status = ? WHERE id = ?")
      .run(errors.length > 0 && productResult.count === 0 && orderResult.count === 0 ? 'error' : 'connected', auth.id);

    const result: SyncResult = {
      success: errors.length === 0,
      store_name: auth.store_name,
      sync_time: new Date().toISOString(),
      synced_data: {
        products_synced: productResult.count,
        orders_synced: orderResult.count,
      },
      errors,
      message: errors.length === 0
        ? `同步成功！同步了 ${productResult.count} 个产品和 ${orderResult.count} 个订单。`
        : `同步部分完成：${productResult.count} 个产品，${orderResult.count} 个订单。${errors.join('; ')}`,
      debug,
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
