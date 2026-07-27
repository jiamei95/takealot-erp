import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST() {
  // Initialize database (tables are auto-created by getDb)
  getDb();

  const db = getDb();
  const counts = {
    stores: (db.prepare('SELECT COUNT(*) as cnt FROM stores').get() as { cnt: number }).cnt,
    products: (db.prepare('SELECT COUNT(*) as cnt FROM products').get() as { cnt: number }).cnt,
    orders: (db.prepare('SELECT COUNT(*) as cnt FROM orders').get() as { cnt: number }).cnt,
    purchase_orders: (db.prepare('SELECT COUNT(*) as cnt FROM purchase_orders').get() as { cnt: number }).cnt,
    store_auth: (db.prepare('SELECT COUNT(*) as cnt FROM store_auth').get() as { cnt: number }).cnt,
  };
  return NextResponse.json({
    success: true,
    message: '数据库已初始化。所有数据通过店铺授权从 Takealot 官方 API 同步获取。',
    counts,
  });
}
