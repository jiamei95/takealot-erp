import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { jsonResponse, errorResponse, optionsResponse } from '@/lib/cors';

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

  return jsonResponse({ products, total, page, page_size: pageSize }, request);
}

export async function POST(request: NextRequest) {
  const db = getDb();
  const body = await request.json();
  const { sku, name, cost_price, selling_price, image_url, takealot_product_id } = body;

  if (!sku || !name) {
    return errorResponse('SKU and name are required', request, 400);
  }

  try {
    const result = db.prepare(
      'INSERT INTO products (sku, name, cost_price, selling_price, image_url, takealot_product_id) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(sku, name, cost_price || 0, selling_price || 0, image_url || '', takealot_product_id || '');

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
    return jsonResponse({ product }, request, 201);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message.includes('UNIQUE constraint failed')) {
      return errorResponse('SKU already exists', request, 409);
    }
    return errorResponse(message, request, 500);
  }
}

export async function OPTIONS(request: Request) {
  return optionsResponse(request);
}
