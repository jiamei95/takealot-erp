import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('page_size') || '50');
  const offset = (page - 1) * pageSize;

  let where = '';
  const params: (string | number)[] = [];

  if (search) {
    where = 'WHERE p.name LIKE ? OR p.sku LIKE ?';
    params.push(`%${search}%`, `%${search}%`);
  }

  const total = (db.prepare(`SELECT COUNT(*) as cnt FROM products p ${where}`).get(...params) as { cnt: number }).cnt;
  const products = db.prepare(`SELECT p.* FROM products p ${where} ORDER BY p.id DESC LIMIT ? OFFSET ?`).all(...params, pageSize, offset);

  return NextResponse.json({ products, total, page, page_size: pageSize });
}

export async function POST(request: NextRequest) {
  const db = getDb();
  const body = await request.json();
  const { sku, name, cost_price, selling_price, image_url, takealot_product_id } = body;

  if (!sku || !name) {
    return NextResponse.json({ error: 'SKU and name are required' }, { status: 400 });
  }

  try {
    const result = db.prepare(
      'INSERT INTO products (sku, name, cost_price, selling_price, image_url, takealot_product_id) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(sku, name, cost_price || 0, selling_price || 0, image_url || '', takealot_product_id || '');

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
    return NextResponse.json({ product }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message.includes('UNIQUE constraint failed')) {
      return NextResponse.json({ error: 'SKU already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
