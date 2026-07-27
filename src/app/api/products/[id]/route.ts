import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { jsonResponse, errorResponse, optionsResponse } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export async function PUT(request: NextRequest) {
  const db = getDb();
  const body = await request.json();
  const { id, sku, name, cost_price, selling_price, image_url, takealot_product_id } = body;

  if (!id) {
    return errorResponse('Product ID is required', request, 400);
  }

  try {
    db.prepare(
      `UPDATE products SET sku=?, name=?, cost_price=?, selling_price=?, image_url=?, takealot_product_id=?, updated_at=datetime('now') WHERE id=?`
    ).run(sku, name, cost_price || 0, selling_price || 0, image_url || '', takealot_product_id || '', id);

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    return jsonResponse({ product }, request);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return errorResponse(message, request, 500);
  }
}

export async function DELETE(request: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return errorResponse('Product ID is required', request, 400);
  }

  try {
    db.prepare('DELETE FROM products WHERE id = ?').run(id);
    return jsonResponse({ success: true }, request);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return errorResponse(message, request, 500);
  }
}

export async function OPTIONS(request: Request) {
  return optionsResponse(request);
}
