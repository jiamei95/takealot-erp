// 后台自动同步服务
// 每分钟自动从 Takealot API 同步数据
// 永久授权：只要数据库中有 API Key，就持续同步

import { getDb } from './db';
import { notifyDataUpdate } from './websocket';

const DEFAULT_BASE_URL = 'https://marketplace-api.takealot.com/v1';
const PAGE_LIMIT = 100;
const MAX_PAGES = 20;
const SYNC_INTERVAL_MS = 15 * 1000; // 15秒

// 同步状态
interface SyncStatus {
  lastSyncTime: string | null;
  isSyncing: boolean;
  productsCount: number;
  ordersCount: number;
  error: string | null;
  syncEnabled: boolean;
  totalSyncs: number;
}

let syncStatus: SyncStatus = {
  lastSyncTime: null,
  isSyncing: false,
  productsCount: 0,
  ordersCount: 0,
  error: null,
  syncEnabled: false,
  totalSyncs: 0,
};

let syncInterval: NodeJS.Timeout | null = null;

// Takealot API 类型定义
interface TakealotOffer {
  offer_id: string;
  tsin_id: string;
  sku: string;
  barcode?: string;
  product_label?: string;
  selling_price: number;
  rrp?: number;
  title: string;
  status: string;
  created_at?: string;
  updated_at?: string;
  image_url?: string;
  images?: Array<{ url: string; is_primary?: boolean }>;
  stock_quantity?: number;
  stock_available?: number;
  inventory?: {
    quantity?: number;
    available?: number;
  };
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

// 获取 API Key（永久授权：只要数据库中有就使用）
function getApiKey(): string | null {
  try {
    const db = getDb();
    
    // 先检查表是否存在
    const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='store_auth'").get();
    if (!tableExists) {
      console.log('[AutoSync] store_auth table not found');
      return null;
    }
    
    // 查询有效的 API Key
    const auth = db.prepare(`SELECT api_key, auth_status FROM store_auth WHERE api_key != '' AND api_key IS NOT NULL LIMIT 1`).get() as { api_key: string; auth_status: string } | undefined;
    
    if (auth?.api_key) {
      console.log('[AutoSync] Found API key:', auth.api_key.substring(0, 20) + '...');
      // 更新状态为已连接
      if (auth.auth_status !== 'connected') {
        db.prepare("UPDATE store_auth SET auth_status = 'connected', updated_at = datetime('now') WHERE api_key = ?").run(auth.api_key);
      }
      return auth.api_key;
    }
    
    console.log('[AutoSync] No valid API key found in database');
    return null;
  } catch (e) {
    console.error('[AutoSync] Failed to get API key:', e);
    return null;
  }
}

// Takealot API 请求
async function fetchTakealot<T>(
  endpoint: string,
  apiKey: string,
  continuationToken?: string,
): Promise<{ data: T | null; status: number; error?: string }> {
  const url = new URL(`${DEFAULT_BASE_URL}${endpoint}`);
  url.searchParams.set('limit', String(PAGE_LIMIT));
  if (continuationToken) {
    url.searchParams.set('continuation_token', continuationToken);
  }

  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey,
        'Accept': 'application/json',
        'User-Agent': 'Takealot-ERP-System/1.0',
      },
      signal: AbortSignal.timeout(30000), // 30秒超时
    });

    const text = await res.text();

    if (!res.ok) {
      if (text.includes('Cloudflare') || text.includes('Attention Required')) {
        return { data: null, status: res.status, error: 'Cloudflare 拦截' };
      }
      return { data: null, status: res.status, error: `HTTP ${res.status}` };
    }

    try {
      const json = JSON.parse(text) as T;
      return { data: json, status: res.status };
    } catch {
      return { data: null, status: res.status, error: 'Invalid JSON' };
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { data: null, status: 0, error: msg };
  }
}

// 同步产品
async function syncProducts(apiKey: string): Promise<{ count: number; error?: string }> {
  const db = getDb();
  let totalSynced = 0;
  let continuationToken: string | undefined;
  let pageCount = 0;

  try {
    do {
      const { data, status, error } = await fetchTakealot<CollectionResponse<TakealotOffer>>(
        '/offers',
        apiKey,
        continuationToken,
      );

      if (error || !data) {
        return { count: totalSynced, error: `请求失败 (${status || error}): ${error}` };
      }

      const items = data.items || [];
      if (items.length === 0) break;

      const upsert = db.prepare(`
        INSERT INTO products (sku, name, cost_price, selling_price, image_url, takealot_product_id, stock_quantity, stock_available, created_at, updated_at)
        VALUES (?, ?, 0, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        ON CONFLICT(sku) DO UPDATE SET
          name = COALESCE(excluded.name, name),
          selling_price = excluded.selling_price,
          image_url = excluded.image_url,
          takealot_product_id = excluded.takealot_product_id,
          stock_quantity = excluded.stock_quantity,
          stock_available = excluded.stock_available,
          updated_at = datetime('now')
      `);

      const tx = db.transaction((offers: TakealotOffer[]) => {
        for (const offer of offers) {
          const sku = offer.sku || offer.offer_id;
          const name = offer.title || offer.product_label || sku;
          const price = offer.selling_price || 0;
          const takealotId = offer.offer_id || '';
          
          let imageUrl = '';
          if (offer.image_url) {
            imageUrl = offer.image_url;
          } else if (offer.images && offer.images.length > 0) {
            const primaryImage = offer.images.find(img => img.is_primary) || offer.images[0];
            imageUrl = primaryImage.url || '';
          }
          
          const stockQuantity = offer.stock_quantity ?? offer.inventory?.quantity ?? 0;
          const stockAvailable = offer.stock_available ?? offer.inventory?.available ?? 0;
          
          upsert.run(sku, name, price, imageUrl, takealotId, stockQuantity, stockAvailable);
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

// 同步订单
async function syncOrders(apiKey: string): Promise<{ count: number; error?: string }> {
  const db = getDb();
  let totalSynced = 0;
  let continuationToken: string | undefined;
  let pageCount = 0;

  try {
    do {
      const { data, status, error } = await fetchTakealot<CollectionResponse<TakealotSale>>(
        '/sales',
        apiKey,
        continuationToken,
      );

      if (error || !data) {
        return { count: totalSynced, error: `请求失败 (${status || error}): ${error}` };
      }

      const items = data.items || [];
      if (items.length === 0) break;

      const tx = db.transaction((sales: TakealotSale[]) => {
        for (const sale of sales) {
          const orderNumber = `TO-${sale.order_id}-${sale.order_item_id}`;
          const orderDate = sale.order_date?.split('T')[0] || new Date().toISOString().split('T')[0];
          
          let product = db.prepare('SELECT id FROM products WHERE takealot_product_id = ?').get(sale.offer_id) as { id: number } | undefined;
          
          if (!product) {
            product = db.prepare('SELECT id FROM products WHERE sku = ?').get(sale.sku) as { id: number } | undefined;
          }
          
          if (!product) {
            const result = db.prepare(
              'INSERT INTO products (sku, name, cost_price, selling_price, takealot_product_id) VALUES (?, ?, 0, ?, ?)'
            ).run(sale.sku, sale.sku, sale.selling_price, sale.offer_id);
            product = { id: Number(result.lastInsertRowid) };
          }
          
          const profit = sale.selling_price * sale.quantity - sale.total_fees;
          
          db.prepare(`
            INSERT INTO orders (order_number, order_date, product_id, quantity, selling_price, cost_price, platform_commission, payment_fee, storage_fee, other_fees, profit, status, store_name)
            VALUES (?, ?, ?, ?, ?, 0, ?, ?, 0, 0, ?, ?, 'Default Store')
            ON CONFLICT(order_number) DO UPDATE SET
              quantity = excluded.quantity,
              selling_price = excluded.selling_price,
              profit = excluded.profit,
              status = excluded.status
          `).run(
            orderNumber,
            orderDate,
            product.id,
            sale.quantity,
            sale.selling_price,
            sale.success_fee,
            sale.fulfillment_fee + sale.courier_collection_fee,
            profit,
            sale.sale_status,
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

// 执行同步
export async function performSync(): Promise<SyncStatus> {
  if (syncStatus.isSyncing) {
    return syncStatus;
  }

  syncStatus.isSyncing = true;
  syncStatus.error = null;

  const apiKey = getApiKey();
  if (!apiKey) {
    syncStatus.isSyncing = false;
    syncStatus.error = '未找到 API Key，请先配置店铺授权';
    return syncStatus;
  }

  try {
    const [productsResult, ordersResult] = await Promise.all([
      syncProducts(apiKey),
      syncOrders(apiKey),
    ]);

    syncStatus.productsCount = productsResult.count;
    syncStatus.ordersCount = ordersResult.count;
    syncStatus.lastSyncTime = new Date().toISOString();
    syncStatus.error = productsResult.error || ordersResult.error || null;
    syncStatus.syncEnabled = true;
    syncStatus.totalSyncs += 1;
    
    // 通知前端有新数据
    notifyDataUpdate('sync', productsResult.count + ordersResult.count);
    
    // 更新最后同步时间
    try {
      const db = getDb();
      db.prepare("UPDATE store_auth SET last_sync_at = datetime('now'), updated_at = datetime('now') WHERE api_key != ''").run();
    } catch (e) {
      console.error('[AutoSync] Failed to update last_sync_at:', e);
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    syncStatus.error = `同步失败: ${msg}`;
  } finally {
    syncStatus.isSyncing = false;
  }

  return syncStatus;
}

// 获取同步状态
export function getSyncStatus(): SyncStatus {
  return { ...syncStatus };
}

// 启动自动同步（每60秒）
// 永久授权模式：只要有 API Key 就持续同步
export function startAutoSync(): void {
  if (syncInterval) {
    console.log('[AutoSync] Already running');
    return;
  }

  // 检查是否有授权
  const apiKey = getApiKey();
  if (!apiKey) {
    console.log('[AutoSync] No API key found, waiting for authorization...');
    // 即使没有授权，也启动检查循环，等待用户授权
  }

  console.log('[AutoSync] Starting permanent auto sync every 60 seconds...');
  syncStatus.syncEnabled = true;
  
  // 立即执行一次（如果有授权）
  if (apiKey) {
    performSync().then(status => {
      console.log('[AutoSync] Initial sync completed:', status);
    });
  }

  // 每60秒检查并同步
  syncInterval = setInterval(() => {
    const key = getApiKey();
    if (key) {
      performSync().then(status => {
        console.log('[AutoSync] Sync completed:', status);
      });
    } else {
      console.log('[AutoSync] Waiting for authorization...');
    }
  }, SYNC_INTERVAL_MS);
}

// 停止自动同步（仅在用户删除授权时调用）
export function stopAutoSync(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
    syncStatus.syncEnabled = false;
    console.log('[AutoSync] Stopped - authorization removed');
  }
}
