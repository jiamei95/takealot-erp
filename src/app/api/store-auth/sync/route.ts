export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { jsonResponse, errorResponse, optionsResponse } from '@/lib/cors';
import type Database from 'better-sqlite3';

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
  // 图片相关
  image_url?: string;
  images?: Array<{ url: string; is_primary?: boolean }>;
  // 库存相关
  stock_quantity?: number;
  stock_available?: number;
  inventory?: {
    quantity?: number;
    available?: number;
  };
}

interface TakealotShipmentItem {
  offer_id: string;
  quantity: number;
  status?: string;
}

interface TakealotShipment {
  shipment_id: string;
  shipment_number?: string;
  destination_warehouse?: string;
  status?: string;
  created_at?: string;
  shipment_items?: TakealotShipmentItem[];
}

// 库存接口 - 每个仓库的库存
interface TakealotInventory {
  sku: string;
  offer_id?: string;
  warehouse_id?: string;
  warehouse_name?: string;
  quantity?: number;
  available?: number;
  reserved?: number;
  in_transit?: number;
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
    po_synced?: number;
  };
  errors: string[];
  message: string;
  debug?: Array<{ url: string; status: number; body?: string }>;
}

// --- Helper: use shared DB connection ---
// getDb() handles /tmp path for production

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
        'User-Agent': 'Takealot-ERP-System/1.0',
        'Accept-Language': 'en-US,en;q=0.9',
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
async function syncOffers(db: ReturnType<typeof getDb>, baseUrl: string, apiKey: string, debug: Array<{ url: string; status: number; body?: string }>): Promise<{ count: number; error?: string }> {
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
          
          // 获取图片 URL
          let imageUrl = '';
          if (offer.image_url) {
            imageUrl = offer.image_url;
          } else if (offer.images && offer.images.length > 0) {
            // 优先获取主图
            const primaryImage = offer.images.find(img => img.is_primary) || offer.images[0];
            imageUrl = primaryImage.url || '';
          }
          
          // 获取库存
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

// --- Sync Inventory (Warehouse Stock) ---
async function syncInventory(db: ReturnType<typeof getDb>, baseUrl: string, apiKey: string, debug: Array<{ url: string; status: number; body?: string }>): Promise<{ count: number; error?: string }> {
  let totalSynced = 0;
  let continuationToken: string | undefined;
  let pageCount = 0;

  try {
    do {
      const { data, status, body, error } = await fetchTakealot<CollectionResponse<TakealotInventory>>(
        baseUrl, '/inventory', apiKey, continuationToken,
      );

      debug.push({ url: `${baseUrl}/inventory${continuationToken ? `?continuation_token=${continuationToken}` : ''}`, status, body });

      if (error || !data) {
        // 如果库存接口不存在，返回 0 但不报错
        if (status === 404 || status === 403) {
          return { count: 0, error: undefined };
        }
        return { count: totalSynced, error: `请求失败 (${status || error}): ${error || body.substring(0, 200)}` };
      }

      const items = data.items || [];
      if (items.length === 0) break;

      // 按 SKU 分组，汇总每个仓库的库存
      const inventoryBySku = new Map<string, {
        total: number;
        available: number;
        warehouses: Map<string, { quantity: number; available: number; name?: string }>;
      }>();

      for (const inv of items) {
        const sku = inv.sku;
        if (!inventoryBySku.has(sku)) {
          inventoryBySku.set(sku, {
            total: 0,
            available: 0,
            warehouses: new Map(),
          });
        }

        const skuData = inventoryBySku.get(sku)!;
        const warehouseId = inv.warehouse_id || inv.warehouse_name || 'default';
        const quantity = inv.quantity || 0;
        const available = inv.available || 0;

        skuData.total += quantity;
        skuData.available += available;
        skuData.warehouses.set(warehouseId, {
          quantity,
          available,
          name: inv.warehouse_name,
        });
      }

      // 更新产品表的库存字段
      const updateStock = db.prepare(`
        UPDATE products 
        SET stock_quantity = ?, stock_available = ?, updated_at = datetime('now')
        WHERE sku = ?
      `);

      // 插入/更新仓库库存表
      const upsertWarehouseStock = db.prepare(`
        INSERT INTO product_warehouse_stock (product_id, sku, warehouse_id, warehouse_name, quantity, available, reserved, in_transit, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 0, 0, datetime('now'))
        ON CONFLICT(product_id, warehouse_id) DO UPDATE SET
          quantity = excluded.quantity,
          available = excluded.available,
          updated_at = datetime('now')
      `);

      const findProduct = db.prepare('SELECT id FROM products WHERE sku = ?');

      const tx = db.transaction((skus: Array<{ sku: string; total: number; available: number; warehouses: Map<string, { quantity: number; available: number; name?: string }> }>) => {
        for (const item of skus) {
          // 更新产品总库存
          updateStock.run(item.total, item.available, item.sku);
          
          // 查找产品 ID
          const product = findProduct.get(item.sku) as { id: number } | undefined;
          if (product) {
            // 插入每个仓库的库存
            for (const [warehouseId, data] of item.warehouses.entries()) {
              upsertWarehouseStock.run(
                product.id,
                item.sku,
                warehouseId,
                data.name || warehouseId,
                data.quantity,
                data.available,
              );
            }
          }
        }
      });

      const skuArray = Array.from(inventoryBySku.entries()).map(([sku, data]) => ({
        sku,
        total: data.total,
        available: data.available,
        warehouses: data.warehouses,
      }));

      tx(skuArray);
      totalSynced += items.length;

      continuationToken = data.continuation_token || undefined;
      pageCount++;
    } while (continuationToken && pageCount < MAX_PAGES);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { count: totalSynced, error: `库存同步异常: ${msg}` };
  }

  return { count: totalSynced };
}

// --- Sync Sales (Orders) ---
async function syncSales(db: ReturnType<typeof getDb>, baseUrl: string, apiKey: string, storeName: string, debug: Array<{ url: string; status: number; body?: string }>): Promise<{ count: number; error?: string }> {
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
        VALUES (?, ?, ?, ?, ?, 0, ?, ?, 0, 0, ?, ?, ?, datetime('now'))
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
            successFee, fulfillmentFee,
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

// --- Sync Purchase Orders ---
async function syncPOs(
  apiKey: string,
  baseUrl: string,
  storeName: string,
  db: Database.Database,
  debug: Array<{ url: string; status: number; body?: string }>,
  errors: string[],
): Promise<{ count: number; error?: string }> {
  let totalSynced = 0;
  let continuationToken = '';
  const maxPages = 10;
  let page = 0;

  const insertPO = db.prepare(`
    INSERT OR IGNORE INTO purchase_orders
      (po_number, destination_warehouse, status, total_items, total_quantity, platform_shipment_id, platform_response, store_name, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `);

  try {
    do {
      page++;
      const url = `${baseUrl}/shipments${continuationToken ? `?continuation_token=${continuationToken}` : ''}`;

      const res = await fetch(url, {
        headers: {
          'X-API-Key': apiKey,
          'Accept': 'application/json',
          'User-Agent': 'Takealot-ERP-System/1.0',
        },
      });

      if (!res.ok) {
        const body = await res.text();
        debug.push({ url, status: res.status, body: body.substring(0, 500) });
        if (res.status === 403) {
          errors.push('请求失败 (403): Cloudflare 拦截 (403) - 请尝试本地运行或更换服务器 IP');
        } else {
          errors.push(`请求失败 (${res.status}): HTTP ${res.status}`);
        }
        break;
      }

      const data = await res.json() as CollectionResponse<TakealotShipment>;
      const items = data.items || [];

      for (const shipment of items) {
        const platformShipmentId = shipment.shipment_id || '';
        const status = shipment.status || 'pending';
        const destination = shipment.destination_warehouse || 'UNKNOWN';
        const totalItems = shipment.shipment_items?.length || 0;
        const totalQuantity = shipment.shipment_items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;

        try {
          // 先尝试匹配 ERP 中的草稿 PO 单
          const draftPO = db.prepare(`
            SELECT id FROM purchase_orders 
            WHERE store_name = ? 
              AND destination_warehouse = ?
              AND status = 'draft'
              AND total_items = ?
              AND total_quantity = ?
            LIMIT 1
          `).get(storeName, destination, totalItems, totalQuantity) as any;

          if (draftPO) {
            // 更新草稿 PO，关联平台信息
            db.prepare(`
              UPDATE purchase_orders 
              SET status = ?,
                  platform_shipment_id = ?,
                  platform_response = ?,
                  updated_at = datetime('now')
              WHERE id = ?
            `).run(status, platformShipmentId, JSON.stringify(shipment), draftPO.id);
          } else {
            // 没有匹配的草稿 PO，创建新的 PO 记录
            insertPO.run(platformShipmentId, destination, status, totalItems, totalQuantity, platformShipmentId, JSON.stringify(shipment), storeName);
          }
          totalSynced++;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error(`插入 PO 失败 ${platformShipmentId}:`, msg);
        }
      }

      continuationToken = data.continuation_token || '';
    } while (continuationToken && page < maxPages);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { count: totalSynced, error: `PO 同步异常: ${msg}` };
  }

  return { count: totalSynced };
}

// --- Main sync handler ---
export async function POST(request: NextRequest) {
  const db = getDb();

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

    // Sync inventory (warehouse stock)
    const inventoryResult = await syncInventory(db, baseUrl, apiKey, debug);
    if (inventoryResult.error) errors.push(inventoryResult.error);

    // Sync sales (orders)
    const storeName = (auth.store_name as string) || '';
    const salesResult = await syncSales(db, baseUrl, apiKey, storeName, debug);
    if (salesResult.error) errors.push(salesResult.error);

    // Sync POs (shipments) from Takealot
    const poResult = await syncPOs(apiKey, baseUrl, storeName, db, debug, errors);
    if (poResult.error) errors.push(poResult.error);

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
        po_synced: poResult.count,
      },
      errors,
      message: errors.length === 0
        ? `同步成功！共同步了 ${productResult.count} 个产品、${salesResult.count} 个订单、${poResult.count} 个 PO 单和 ${inventoryResult.count} 条库存记录。`
        : `同步部分完成：${productResult.count} 个产品，${salesResult.count} 个订单，${poResult.count} 个 PO 单，${inventoryResult.count} 条库存。${errors.join('; ')}`,
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
