import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const status = searchParams.get('status') || '';
  const store = searchParams.get('store') || '';
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('page_size') || '50');
  const offset = (page - 1) * pageSize;

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (search) {
    conditions.push('(o.order_number LIKE ? OR p.name LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  if (status) {
    conditions.push('o.status = ?');
    params.push(status);
  }
  if (store) {
    conditions.push('o.store_name = ?');
    params.push(store);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const total = (db.prepare(`
    SELECT COUNT(*) as cnt FROM orders o
    LEFT JOIN products p ON o.product_id = p.id
    ${where}
  `).get(...params) as { cnt: number }).cnt;

  const orders = db.prepare(`
    SELECT o.*, p.name as product_name, p.sku as product_sku, p.image_url
    FROM orders o
    LEFT JOIN products p ON o.product_id = p.id
    ${where}
    ORDER BY o.order_date DESC, o.id DESC
    LIMIT ? OFFSET ?
  `).all(...params, pageSize, offset);

  return NextResponse.json({ orders, total, page, page_size: pageSize });
}
