import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Takealot API 类型定义（灵活类型，兼容各种响应格式）
interface TakealotOffer {
  [key: string]: unknown;
}

interface TakealotSale {
  [key: string]: unknown;
}

interface TakealotTransaction {
  [key: string]: unknown;
}

interface SyncResult {
  success: boolean;
  store_name: string;
  sync_time: string;
  synced_data: {
    products_synced: number;
    orders_synced: number;
    transactions_synced: number;
  };
  errors: string[];
  message: string;
  debug: Array<{ url: string; status: number; body: string }>;
}

// 通用分页请求函数
async function fetchAllPages<T>(
  baseUrl: string,
  endpoint: string,
  headers: Record<string, string>,
  debug: Array<{ url: string; status: number; body: string }>
): Promise<{ data: T[]; error: string | null }> {
  const allData: T[] = [];
  let continuationToken: string | null = null;
  let attempts = 0;
  const maxAttempts = 10;

  do {
    const params = new URLSearchParams();
    if (continuationToken) {
      params.set('continuation_token', continuationToken);
    }

    const url = `${baseUrl}${endpoint}${params.toString() ? '?' + params.toString() : ''}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      const text = await response.text();
      debug.push({ url, status: response.status, body: text.slice(0, 500) });

      if (!response.ok) {
        return { data: [], error: `请求失败 (${response.status}): ${text.slice(0, 300)}` };
      }

      let json: Record<string, unknown>;
      try {
        json = JSON.parse(text);
      } catch {
        return { data: [], error: `响应不是有效 JSON: ${text.slice(0, 200)}` };
      }

      // 灵活提取数据数组 - 尝试多种可能的字段名
      const items = extractArray(json);
      allData.push(...(items as T[]));

      // 检查分页游标 - 尝试多种可能的字段名
      continuationToken = extractContinuationToken(json);
      attempts++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : '未知错误';
      return { data: [], error: `网络请求异常: ${msg}` };
    }
  } while (continuationToken && attempts < maxAttempts);

  return { data: allData, error: null };
}

// 从响应中提取数据数组
function extractArray(json: Record<string, unknown>): unknown[] {
  if (Array.isArray(json)) return json;

  // 尝试常见的数据字段名
  const candidates = [
    'results', 'data', 'items', 'offers', 'sales', 'transactions',
    'records', 'list', 'rows', 'content', 'entries', 'products', 'orders'
  ];

  for (const key of candidates) {
    const val = json[key];
    if (Array.isArray(val) && val.length > 0) return val;
  }

  // 尝试嵌套结构，如 { body: { results: [...] } }
  const bodyKeys = ['body', 'response', 'payload', 'result'];
  for (const bk of bodyKeys) {
    const body = json[bk];
    if (body && typeof body === 'object') {
      const nested = extractArray(body as Record<string, unknown>);
      if (nested.length > 0) return nested;
    }
  }

  // 尝试第一个数组类型的值
  for (const val of Object.values(json)) {
    if (Array.isArray(val) && val.length > 0) return val;
  }

  return [];
}

// 从响应中提取分页游标
function extractContinuationToken(json: Record<string, unknown>): string | null {
  const tokenKeys = [
    'continuation_token', 'next_token', 'next_cursor', 'cursor',
    'page_token', 'next_page_token', 'paging_token'
  ];

  for (const key of tokenKeys) {
    const val = json[key];
    if (typeof val === 'string' && val) return val;
  }

  // 尝试嵌套 paging 对象
  const pagingKeys = ['paging', 'pagination', 'page', 'meta'];
  for (const pk of pagingKeys) {
    const paging = json[pk];
    if (paging && typeof paging === 'object') {
      for (const key of tokenKeys) {
        const val = (paging as Record<string, unknown>)[key];
        if (typeof val === 'string' && val) return val;
      }
    }
  }

  return null;
}

// 安全提取字符串值
function str(val: unknown): string {
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return val.toString();
  if (val && typeof val === 'object' && 'toString' in val) return String(val);
  return '';
}

// 安全提取数值
function num(val: unknown): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') return parseFloat(val) || 0;
  return 0;
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
    return { count: 0, error: '产品同步失败: /offers 返回数据为空（可能 API Key 无权限或字段名不匹配）' };
  }

  const db = getDb();
  let count = 0;

  for (const offer of offers) {
    const o = offer as Record<string, unknown>;
    const sku = str(o.sku || o.seller_product_id || o.offer_id || o.product_id || o.id || '');
    const name = str(o.title || o.product_title || o.name || o.product_name || o.description || '');
    const sellingPrice = num(o.selling_price || o.price || o.list_price || o.buy_price || 0);
    const productId = str(o.product_id || o.offer_id || o.id || '');

    if (!sku) continue;

    try {
      const existing = db.prepare('SELECT id FROM products WHERE sku = ?').get(sku) as { id: number } | undefined;

      if (existing) {
        db.prepare(
          `UPDATE products SET name = ?, selling_price = ?, updated_at = datetime('now') WHERE id = ?`
        ).run(name, sellingPrice, existing.id);
      } else {
        db.prepare(
          `INSERT INTO products (sku, name, cost_price, selling_price, takealot_product_id, created_at, updated_at)
           VALUES (?, ?, 0, ?, ?, datetime('now'), datetime('now'))`
        ).run(sku, name, sellingPrice, productId);
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
    return { count: 0, error: '订单同步失败: /sales 返回数据为空（可能 API Key 无权限或字段名不匹配）' };
  }

  const db = getDb();
  let count = 0;

  for (const sale of sales) {
    const s = sale as Record<string, unknown>;

    // 灵活提取字段 - 尝试多种可能的字段名
    const orderId = str(
      s.order_id || s.sale_order_id || s.order_number || s.sale_id ||
      s.id || s.reference || s.order_reference || ''
    );
    const sku = str(s.sku || s.seller_product_id || s.product_sku || s.offer_id || '');
    const quantity = num(s.quantity || s.qty || s.units || 1);
    const sellingPrice = num(
      s.selling_price || s.price || s.amount || s.product_amount ||
      s.sale_price || s.unit_price || s.revenue || 0
    );
    const orderDate = str(
      s.order_date || s.sale_date || s.created_date || s.date ||
      s.order_created_date || s.purchase_date || new Date().toISOString().split('T')[0]
    );
    const status = str(s.status || s.state || s.order_status || s.sale_status || 'completed');

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
        // 提取费用字段
        const commission = num(s.commission || s.platform_commission || s.fee || s.takealot_commission || 0);
        const paymentFee = num(s.payment_fee || s.payment_processing_fee || 0);
        const storageFee = num(s.storage_fee || s.warehouse_fee || 0);
        const otherFees = num(s.platform_fee || s.other_fees || s.handling_fee || 0);
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

// 同步交易明细（transactions）
async function syncTransactions(
  baseUrl: string,
  headers: Record<string, string>,
  debug: Array<{ url: string; status: number; body: string }>
): Promise<{ count: number; error: string | null }> {
  const result = await fetchAllPages<TakealotTransaction>(baseUrl, '/transactions', headers, debug);

  if (result.error) {
    return { count: 0, error: null }; // transactions 失败不影响整体
  }

  return { count: result.data.length, error: null };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { store_id } = body as { store_id: number };

    if (!store_id) {
      return NextResponse.json({ error: '缺少 store_id 参数' }, { status: 400 });
    }

    const db = getDb();
    const auth = db.prepare('SELECT * FROM store_auth WHERE id = ?').get(store_id) as
      { id: number; store_name: string; api_key: string; api_secret: string; api_base_url: string; access_token: string } | undefined;

    if (!auth) {
      return NextResponse.json({ error: '未找到该店铺授权信息' }, { status: 404 });
    }

    if (!auth.api_key && !auth.access_token) {
      return NextResponse.json({ error: 'API Key 未配置，请先编辑授权信息' }, { status: 400 });
    }

    const baseUrl = auth.api_base_url || 'https://marketplace-api.takealot.com/v1';

    // 构建请求头
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (auth.access_token) {
      headers['Authorization'] = `Bearer ${auth.access_token}`;
    } else {
      headers['Authorization'] = `Bearer ${auth.api_key}`;
    }

    const debug: Array<{ url: string; status: number; body: string }> = [];
    const errors: string[] = [];

    // 并行同步产品、订单、交易
    const [productsResult, ordersResult, transactionsResult] = await Promise.all([
      syncProducts(baseUrl, headers, auth.store_name, debug),
      syncOrders(baseUrl, headers, auth.store_name, debug),
      syncTransactions(baseUrl, headers, debug),
    ]);

    if (productsResult.error) errors.push(productsResult.error);
    if (ordersResult.error) errors.push(ordersResult.error);

    // 更新同步时间
    try {
      db.prepare(`UPDATE store_auth SET last_sync_at = datetime('now'), auth_status = ? WHERE id = ?`)
        .run(errors.length > 0 ? 'error' : 'connected', auth.id);
    } catch (e) {
      console.error('Failed to update sync time:', e);
    }

    const result: SyncResult = {
      success: errors.length === 0,
      store_name: auth.store_name,
      sync_time: new Date().toISOString(),
      synced_data: {
        products_synced: productsResult.count,
        orders_synced: ordersResult.count,
        transactions_synced: transactionsResult.count,
      },
      errors,
      message: errors.length === 0
        ? `同步成功！共同步 ${productsResult.count} 个产品，${ordersResult.count} 个订单。`
        : `同步部分完成：${productsResult.count} 个产品，${ordersResult.count} 个订单。${errors.join('; ')}`,
      debug,
    };

    return NextResponse.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : '同步失败: 未知错误';
    console.error('Sync error:', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
