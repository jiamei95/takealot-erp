import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * POST /api/store-auth/sync
 * Simulate syncing data from Takealot API.
 * In production, this would call the actual Takealot API
 * using the stored credentials to fetch orders, products, etc.
 */
export async function POST(request: Request) {
  const db = getDb();
  const body = await request.json();
  const { store_id } = body;

  if (!store_id) {
    return NextResponse.json(
      { error: '\u5e97\u94fa ID \u4e3a\u5fc5\u586b\u9879' },
      { status: 400 }
    );
  }

  // Get store auth info
  const storeAuth = db
    .prepare('SELECT * FROM store_auth WHERE id = ?')
    .get(store_id) as Record<string, unknown> | undefined;

  if (!storeAuth) {
    return NextResponse.json(
      { error: '\u5e97\u94fa\u6388\u6743\u8bb0\u5f55\u4e0d\u5b58\u5728' },
      { status: 404 }
    );
  }

  if (storeAuth.auth_status !== 'connected') {
    return NextResponse.json(
      { error: '\u5e97\u94fa\u672a\u6388\u6743\uff0c\u8bf7\u5148\u5b8c\u6210\u6388\u6743\u914d\u7f6e' },
      { status: 400 }
    );
  }

  // Simulate API call to Takealot
  // In production, this would use the api_key/api_secret/access_token
  // to call Takealot's official API endpoints:
  // - GET /api/seller/products - fetch product list
  // - GET /api/seller/orders - fetch orders
  // - GET /api/seller/inventory - fetch inventory

  const syncTime = new Date().toISOString().replace('T', ' ').substring(0, 19);

  // Update last sync time
  db.prepare('UPDATE store_auth SET last_sync_at = ?, updated_at = datetime(\'now\') WHERE id = ?').run(
    syncTime,
    store_id
  );

  // Simulate sync results
  const syncResult = {
    success: true,
    store_name: storeAuth.store_name,
    sync_time: syncTime,
    synced_data: {
      products_synced: Math.floor(Math.random() * 20) + 5,
      orders_synced: Math.floor(Math.random() * 50) + 10,
      inventory_updated: Math.floor(Math.random() * 30) + 1,
    },
    message: `\u6570\u636e\u540c\u6b65\u6210\u529f\u3002\u5728\u751f\u4ea7\u73af\u5883\u4e2d\uff0c\u8fd9\u5c06\u8c03\u7528 Takealot \u5b98\u65b9 API \u83b7\u53d6\u6700\u65b0\u6570\u636e\u3002`,
  };

  return NextResponse.json(syncResult);
}
