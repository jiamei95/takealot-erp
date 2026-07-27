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
  const {
    store_name,
    api_key = '',
    api_secret = '',
    access_token = '',
    token_expires_at = '',
  } = body;

  if (!store_name) {
    return NextResponse.json(
      { error: '店铺名称为必填项' },
      { status: 400 }
    );
  }

  // 检查是否至少有一种认证方式
  const hasKeyAndSecret = api_key && api_secret;
  const hasToken = access_token;
  if (!hasKeyAndSecret && !hasToken) {
    return NextResponse.json(
      { error: '请至少填写 API Key + API Secret 或 Access Token' },
      { status: 400 }
    );
  }

  // Check if store already exists
  const existing = db
    .prepare('SELECT id FROM store_auth WHERE store_name = ?')
    .get(store_name) as { id: number } | undefined;

  if (existing) {
    // Update existing
    db.prepare(
      `UPDATE store_auth SET
        api_key = ?, api_secret = ?, access_token = ?,
        token_expires_at = ?, auth_status = 'connected',
        updated_at = datetime('now')
      WHERE id = ?`
    ).run(api_key, api_secret, access_token, token_expires_at, existing.id);

    const updated = db.prepare('SELECT * FROM store_auth WHERE id = ?').get(existing.id);
    return NextResponse.json({ store_auth: updated });
  }

  // Create new
  const result = db
    .prepare(
      `INSERT INTO store_auth (store_name, api_key, api_secret, access_token, token_expires_at, auth_status)
       VALUES (?, ?, ?, ?, ?, 'connected')`
    )
    .run(store_name, api_key, api_secret, access_token, token_expires_at);

  const created = db.prepare('SELECT * FROM store_auth WHERE id = ?').get(result.lastInsertRowid);
  return NextResponse.json({ store_auth: created });
}

// PUT /api/store-auth - update auth status or sync
export async function PUT(request: Request) {
  const db = getDb();
  const body = await request.json();
  const { id, auth_status, last_sync_at } = body;

  if (!id) {
    return NextResponse.json({ error: 'ID \u4e3a\u5fc5\u586b\u9879' }, { status: 400 });
  }

  const updates: string[] = [];
  const params: unknown[] = [];

  if (auth_status) {
    updates.push('auth_status = ?');
    params.push(auth_status);
  }
  if (last_sync_at) {
    updates.push('last_sync_at = ?');
    params.push(last_sync_at);
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: '\u65e0\u6709\u6548\u66f4\u65b0\u5b57\u6bb5' }, { status: 400 });
  }

  updates.push("updated_at = datetime('now')");
  params.push(id);

  db.prepare(`UPDATE store_auth SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  const updated = db.prepare('SELECT * FROM store_auth WHERE id = ?').get(id);
  return NextResponse.json({ store_auth: updated });
}

// DELETE /api/store-auth - delete store auth
export async function DELETE(request: Request) {
  const db = getDb();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'ID \u4e3a\u5fc5\u586b\u9879' }, { status: 400 });
  }

  db.prepare('DELETE FROM store_auth WHERE id = ?').run(parseInt(id));
  return NextResponse.json({ success: true });
}
