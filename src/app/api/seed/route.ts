import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST() {
  // Import seed module - it runs seed() on import
  await import('@/lib/seed');

  const db = getDb();
  const counts = {
    stores: (db.prepare('SELECT COUNT(*) as cnt FROM stores').get() as { cnt: number }).cnt,
    products: (db.prepare('SELECT COUNT(*) as cnt FROM products').get() as { cnt: number }).cnt,
    orders: (db.prepare('SELECT COUNT(*) as cnt FROM orders').get() as { cnt: number }).cnt,
    purchase_orders: (db.prepare('SELECT COUNT(*) as cnt FROM purchase_orders').get() as { cnt: number }).cnt,
  };
  return NextResponse.json({ success: true, counts });
}
