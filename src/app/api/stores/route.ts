import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const db = getDb();
  // Get stores from both stores table and store_auth table
  const stores = db.prepare('SELECT * FROM stores ORDER BY name').all();
  const authStores = db.prepare(`
    SELECT id, store_name as name FROM store_auth 
    WHERE auth_status = 'connected'
    AND store_name NOT IN (SELECT name FROM stores)
  `).all();
  const allStores = [...stores, ...authStores];
  return jsonResponse({ stores: allStores }, request);
}

export async function OPTIONS(request: Request) {
  return optionsResponse(request);
}
