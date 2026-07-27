import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/store-auth - list all store auth records
export async function GET() {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM store_auth ORDER BY created_at DESC').all();
  return NextResponse.json({ store_auth: rows });
}

// POST /api/store-auth - create or update store auth
export async function POST(request: Request) {
  const db = getDb();
  const body = await request.json();
  const { store_name, api_key = '', api_base_url } = body;

  if (!store_name || !api_key) {
    return NextResponse.json(
      { error: '店铺名称和 API Key 为必填项' },
      { status: 400 }
    );
  }

  const baseUrl = api_base_url || 'https://marketplace-api.takealot.com/v1';

  // Check if store already exists
  const existing = db
    .prepare('SELECT id FROM store_auth WHERE store_name = ?')
    .get(store_name) as { id: number } | undefined;

  if (existing) {
    db.prepare(
      `UPDATE store_auth SET api_key = ?, api_base_url = ?, auth_status = 'connected', updated_at = datetime('now') WHERE id = ?`
    ).run(api_key, baseUrl, existing.id);
    const updated = db.prepare('SELECT * FROM store_auth WHERE id = ?').get(existing.id);
    return NextResponse.json({ store_auth: updated });
  }

  db.prepare(
    `INSERT INTO store_auth (store_name, api_key, api_base_url, auth_status, created_at, updated_at) VALUES (?, ?, ?, 'connected', datetime('now'), datetime('now'))`
  ).run(store_name, api_key, baseUrl);

  const created = db.prepare('SELECT * FROM store_auth WHERE id = last_insert_rowid()').get();
  return NextResponse.json({ store_auth: created });
}

// PUT /api/store-auth - update auth status
export async function PUT(request: Request) {
  const db = getDb();
  const body = await request.json();
  const { id, status } = body;

  if (!id || !status) {
    return NextResponse.json({ error: '缺少参数' }, { status: 400 });
  }

  db.prepare('UPDATE store_auth SET auth_status = ?, updated_at = datetime("now") WHERE id = ?').run(status, id);
  const updated = db.prepare('SELECT * FROM store_auth WHERE id = ?').get(id);
  return NextResponse.json({ store_auth: updated });
}

// DELETE /api/store-auth
export async function DELETE(request: Request) {
  const db = getDb();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: '缺少 id 参数' }, { status: 400 });
  }

  db.prepare('DELETE FROM store_auth WHERE id = ?').run(Number(id));
  return NextResponse.json({ success: true });
}
