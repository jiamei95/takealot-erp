import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PUT(request: NextRequest) {
  const db = getDb();
  const body = await request.json();
  const { id, status } = body;

  if (!id || !status) {
    return NextResponse.json({ error: 'ID and status are required' }, { status: 400 });
  }

  const validStatuses = ['pending', 'shipped', 'delivered'];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  try {
    db.prepare(`UPDATE purchase_orders SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(status, id);
    const po = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(id) as Record<string, unknown>;
    const items = db.prepare(`
      SELECT poi.*, p.name as product_name, p.sku as product_sku
      FROM purchase_order_items poi
      LEFT JOIN products p ON poi.product_id = p.id
      WHERE poi.po_id = ?
    `).all(id);

    return NextResponse.json({ purchase_order: { ...po, items } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'PO ID is required' }, { status: 400 });
  }

  try {
    db.prepare('DELETE FROM purchase_order_items WHERE po_id = ?').run(id);
    db.prepare('DELETE FROM purchase_orders WHERE id = ?').run(id);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
