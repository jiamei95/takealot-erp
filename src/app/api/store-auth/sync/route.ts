export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { jsonResponse, errorResponse, optionsResponse } from '@/lib/cors';
import * as path from 'path';
import * as fs from 'fs';

// ============================================================
// Takealot Marketplace API Sync
// Docs: https://marketplace-api.takealot.com/v1/docs
// ============================================================

const DEFAULT_BASE_URL = 'https://marketplace-api.takealot.com/v1';
const PAGE_LIMIT = 100;
const MAX_PAGES = 20;

// --- Types based on Takealot OpenAPI spec ---

interface TakealotOffer {
  offer_id: string;
  tsin_id: string;
  sku: string;
  barcode?: string;
  product_label?: string;
  selling_price: number;
  rrp?: number;
  title: string;
  status: 'buyable' | 'not_buyable' | 'disabled_by_seller' | 'disabled_by_takealot';
  created_at?: string;
  updated_at?: string;
}

interface TakealotSale {
  order_item_id: number;
  order_id: number;
  order_date: string;
  sale_status: string;
  offer_id: string;
  tsin_id: string;
  sku: string;
  selling_price: number;
  quantity: number;
  success_fee: number;
  fulfillment_fee: number;
  courier_collection_fee: number;
  total_fees: number;
  stock_transfer_fee?: number;
  sales_region?: string;
  stock_source_region?: string;
}

interface CollectionResponse<T> {
  items: T[];
  limit: number;
  count: number;
  continuation_token: string;
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
  debug?: Array<{ url: string; status: number; body?: string }>;
}

// --- Helper: create a fresh DB connection for this route ---
function getSyncDb() {
  const dbPath = path.join(process.cwd(), 'data', 'erp.db');
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const Database = require('better-sqlite3');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  return db;
}

// --- Takealot API client ---
async function fetchTakealot<T>(
  baseUrl: string,
  endpoint: string,
  apiKey: string,
  continuationToken?: string,
): Promise<{ data: T | null; status: number; body: string; error?: string }> {
  const url = new URL(`${baseUrl.replace(/\/$/, '')}${endpoint}`);
  url.searchParams.set('limit', String(PAGE_LIMIT));
  if (continuationToken) {
    url.searchParams.set('continuation_token', continuationToken);
  }

  console.log(`[Takealot] Fetching ${url.toString()}`);

  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey,
        'Accept': 'application/json',
      },
    });

    const text = await res.text();
    console.log(`[Takealot] Response status: ${res.status}, length: ${text.length}`);

    if (!res.ok) {
      // Check if it's a Cloudflare block page
      if (text.includes('Cloudflare') || text.includes('Attention Required')) {
        return { data: null, status: res.status, body: text.substring(0, 500), error: 'Cloudflare 拦截 (403) - 请尝试本地运行或更换服务器 IP' };
      }
      return { data: null, status: res.status, body: text.substring(0, 500), error: `HTTP ${res.status}` };
    }

    try {
      const json = JSON.parse(text) as T;
      console.log(`[Takealot] Parsed JSON, items count: ${(json as any)?.items?.length ?? 'N/A'}`);
      return { data: json, status: res.status, body: text.substring(0, 500) };
    } catch {
      return { data: null, status: res.status, body: text.substring(0, 500), error: 'Invalid JSON' };
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[Takealot] Fetch error:`, e);
    return { data: null, status: 0, body: '', error: msg };
  }
}

// --- Sync Offers (Products) ---
async function syncOffers(db: ReturnType<typeof getSyncDb>, baseUrl: string, apiKey: string, debug: Array<{ url: string; status: number; body?: string }>): Promise<{ count: number; error?: string }> {
  let totalSynced = 0;
  let continuationToken: string | undefined;
  let pageCount = 0;

  try {
    do {
      const { data, status, body, error } = await fetchTakealot<CollectionResponse<TakealotOffer>>(
        baseUrl, '/offers', apiKey, continuationToken,
      );

      debug.push({ url: `${baseUrl}/offers${continuationToken ? `?continuation_token=${continuationToken}` : ''}`, status, body });

      if (error || !data) {
        return { count: totalSynced, error: `请求失败 (${status || error}): ${error || body.substring(0, 200)}` };
      }

      const items = data.items || [];
      if (items.length === 0) break;

      const upsert = db.prepare(`
        INSERT INTO products (sku, name, cost_price, selling_price, image_url, takealot_product_id, created_at, updated_at)
        VALUES (?, ?, 0, ?, '', ?, datetime('now'), datetime('now'))
        ON CONFLICT(sku) DO UPDATE SET
          name = COALESCE(excluded.name, name),
          selling_price = excluded.selling_price,
          takealot_product_id = excluded.takealot_product_id,
          updated_at = datetime('now')
      `);

      const tx = db.transaction((offers: TakealotOffer[]) => {
        for (const offer of offers) {
          const sku = offer.sku || offer.offer_id;
          const name = offer.title || offer.product_label || sku;
          const price = offer.selling_price || 0;
          const takealotId = offer.offer_id || '';
          upsert.run(sku, name, price, takealotId);
        }
      });
      tx(items);
      totalSynced += items.length;

      continuationToken = data.continuation_token || undefined;
      pageCount++;
    } while (continuationToken && pageCount < MAX_PAGES);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { count: totalSynced, error: `产品同步异常: ${msg}` };
  }

  return { count: totalSynced };
}

// --- Sync Sales (Orders) ---
async function syncSales(db: ReturnType<typeof getSyncDb>, baseUrl: string, apiKey: string, storeName: string, debug: Array<{ url: string; status: number; body?: string }>): Promise<{ count: number; error?: string }> {
  let totalSynced = 0;
  let continuationToken: string | undefined;
  let pageCount = 0;

  try {
    do {
      const { data, status, body, error } = await fetchTakealot<CollectionResponse<TakealotSale>>(
        baseUrl, '/sales', apiKey, continuationToken,
      );

      debug.push({ url: `${baseUrl}/sales${continuationToken ? `?continuation_token=${continuationToken}` : ''}`, status, body });

      if (error || !data) {
        return { count: totalSynced, error: `请求失败 (${status || error}): ${error || body.substring(0, 200)}` };
      }

      const items = data.items || [];
      if (items.length === 0) break;

      const insertOrder = db.prepare(`
        INSERT OR IGNORE INTO orders
          (order_number, order_date, product_id, quantity, selling_price, cost_price,
           platform_commission, payment_fee, storage_fee, other_fees, profit,
           status, store_name, created_at)
        VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, 0, ?, ?, ?, datetime('now'))
      `);

      const findProduct = db.prepare('SELECT id FROM products WHERE sku = ? OR takealot_product_id = ? LIMIT 1');

      const tx = db.transaction((sales: TakealotSale[]) => {
        for (const sale of sales) {
          const orderNumber = `TK-${sale.order_id}-${sale.order_item_id}`;
          const orderDate = sale.order_date ? sale.order_date.substring(0, 10) : new Date().toISOString().substring(0, 10);

          // Find matching product by sku or offer_id
          let product = findProduct.get(sale.sku, sale.offer_id) as { id: number } | undefined;
          let productId: number | null = product?.id ?? null;

          // If product not found, create a placeholder
          if (!productId) {
            const insertProduct = db.prepare(`
              INSERT INTO products (sku, name, cost_price, selling_price, image_url, takealot_product_id, created_at, updated_at)
              VALUES (?, ?, 0, ?, '', ?, datetime('now'), datetime('now'))
            `);
            const result = insertProduct.run(sale.sku, sale.sku, sale.selling_price, sale.offer_id);
            productId = result.lastInsertRowid as number;
          }

          const quantity = sale.quantity || 1;
          const sellingPrice = sale.selling_price || 0;
          const successFee = sale.success_fee || 0;
          const fulfillmentFee = sale.fulfillment_fee || 0;
          const courierFee = sale.courier_collection_fee || 0;
          const totalFees = sale.total_fees || (successFee + fulfillmentFee + courierFee);

          // Map fees: platform_commission = success_fee, payment_fee = fulfillment_fee, storage_fee = courier_collection_fee
          const profit = (sellingPrice * quantity) - totalFees;

          // Map sale_status to our status
          let status = 'pending';
          const ss = (sale.sale_status || '').toLowerCase();
          if (ss.includes('deliver') || ss.includes('complet')) status = 'completed';
          else if (ss.includes('ship') || ss.includes('transit')) status = 'shipped';
          else if (ss.includes('cancel')) status = 'cancelled';

          insertOrder.run(
            orderNumber, orderDate, productId, quantity, sellingPrice,
            successFee, fulfillmentFee, courierFee,
            profit, status, storeName || 'Default Store',
          );
        }
      });
      tx(items);
      totalSynced += items.length;

      continuationToken = data.continuation_token || undefined;
      pageCount++;
    } while (continuationToken && pageCount < MAX_PAGES);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { count: totalSynced, error: `订单同步异常: ${msg}` };
  }

  return { count: totalSynced };
}

// --- Main sync handler ---
export async function POST(request: NextRequest) {
  const db = getSyncDb();

  try {
    const body = await request.json();
    const { store_id } = body;

    const auth = db.prepare('SELECT * FROM store_auth WHERE id = ?').get(store_id) as Record<string, unknown> | undefined;
    if (!auth) {
      return errorResponse('未找到该店铺授权信息', request, 404);
    }

    const apiKey = (auth.api_key as string) || '';
    const baseUrl = (auth.api_base_url as string) || DEFAULT_BASE_URL;

    if (!apiKey) {
      return errorResponse('API Key 未配置，请先编辑授权信息填写 API Key', request, 400);
    }

    const debug: Array<{ url: string; status: number; body?: string }> = [];
    const errors: string[] = [];

    // Sync offers (products)
    const productResult = await syncOffers(db, baseUrl, apiKey, debug);
    if (productResult.error) errors.push(productResult.error);

    // Sync sales (orders)
    const storeName = (auth.store_name as string) || '';
    const salesResult = await syncSales(db, baseUrl, apiKey, storeName, debug);
    if (salesResult.error) errors.push(salesResult.error);

    // Update sync time
    db.prepare("UPDATE store_auth SET last_sync_at = datetime('now'), auth_status = ? WHERE id = ?")
      .run(errors.length > 0 ? 'error' : 'connected', auth.id);

    const result: SyncResult = {
      success: errors.length === 0,
      store_name: auth.store_name as string,
      sync_time: new Date().toISOString(),
      synced_data: {
        products_synced: productResult.count,
        orders_synced: salesResult.count,
      },
      errors,
      message: errors.length === 0
        ? `同步成功！共同步了 ${productResult.count} 个产品和 ${salesResult.count} 个订单。`
        : `同步部分完成：${productResult.count} 个产品，${salesResult.count} 个订单。${errors.join('; ')}`,
      debug: debug.slice(-10),
    };

    return jsonResponse(result, request);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return errorResponse(`同步失败: ${msg}`, request, 500);
  }
}

export async function OPTIONS(request: Request) {
  return optionsResponse(request);
}
