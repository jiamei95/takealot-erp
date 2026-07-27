import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('page_size') || '50');
  const offset = (page - 1) * pageSize;

  const total = (db.prepare('SELECT COUNT(*) as cnt FROM purchase_orders').get() as { cnt: number }).cnt;
  const pos = db.prepare('SELECT * FROM purchase_orders ORDER BY created_at DESC LIMIT ? OFFSET ?').all(pageSize, offset);

  const result = pos.map((po) => {
    const poRecord = po as Record<string, unknown>;
    const items = db.prepare(`
      SELECT poi.*, p.name as product_name, p.sku as product_sku
      FROM purchase_order_items poi
      LEFT JOIN products p ON poi.product_id = p.id
      WHERE poi.po_id = ?
    `).all(poRecord.id);
    return { ...poRecord, items };
  });

  return NextResponse.json({ purchase_orders: result, total, page, page_size: pageSize });
}

export async function POST(request: NextRequest) {
  const db = getDb();
  const body = await request.json();
  const { po_number, notes, items } = body;

  if (!po_number || !items || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'PO number and items are required' }, { status: 400 });
  }

  try {
    const insertPO = db.prepare('INSERT INTO purchase_orders (po_number, status, notes) VALUES (?, ?, ?)');
    const insertItem = db.prepare('INSERT INTO purchase_order_items (po_id, product_id, quantity) VALUES (?, ?, ?)');

    const createPO = db.transaction(() => {
      const result = insertPO.run(po_number, 'pending', notes || '');
      const poId = result.lastInsertRowid;
      for (const item of items) {
        insertItem.run(poId, item.product_id, item.quantity);
      }
      return poId;
    });

    const poId = createPO();
    const po = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(poId) as Record<string, unknown>;
    const poItems = db.prepare(`
      SELECT poi.*, p.name as product_name, p.sku as product_sku
      FROM purchase_order_items poi
      LEFT JOIN products p ON poi.product_id = p.id
      WHERE poi.po_id = ?
    `).all(poId);

    return NextResponse.json({ purchase_order: { ...po, items: poItems } }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message.includes('UNIQUE constraint failed')) {
      return NextResponse.json({ error: 'PO number already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
