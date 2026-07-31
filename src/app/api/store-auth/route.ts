import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { jsonResponse, errorResponse, optionsResponse } from '@/lib/cors';
import { stopAutoSync } from '@/lib/auto-sync';

export const dynamic = 'force-dynamic';

// GET /api/store-auth - list all store auth records
export async function GET(request: Request) {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM store_auth ORDER BY created_at DESC').all();
  return jsonResponse({ store_auth: rows }, request);
}

// POST /api/store-auth - create or update store auth
export async function POST(request: Request) {
  try {
    const db = getDb();
    const body = await request.json();
    const { store_name, api_key = '', api_base_url } = body;

    if (!store_name || !api_key) {
      return errorResponse('店铺名称和 API Key 为必填项', request, 400);
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
      return jsonResponse({ store_auth: updated }, request);
    }

    db.prepare(
      `INSERT INTO store_auth (store_name, api_key, api_base_url, auth_status, created_at, updated_at) VALUES (?, ?, ?, 'connected', datetime('now'), datetime('now'))`
    ).run(store_name, api_key, baseUrl);

    const created = db.prepare('SELECT * FROM store_auth WHERE id = last_insert_rowid()').get();
    return jsonResponse({ store_auth: created }, request);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[API] POST /api/store-auth error:', err);
    return errorResponse(`服务器错误: ${message}`, request, 500);
  }
}

// PUT /api/store-auth - update auth status
export async function PUT(request: Request) {
  const db = getDb();
  const body = await request.json();
  const { id, status } = body;

  if (!id || !status) {
    return errorResponse('缺少参数', request, 400);
  }

  db.prepare('UPDATE store_auth SET auth_status = ?, updated_at = datetime("now") WHERE id = ?').run(status, id);
  const updated = db.prepare('SELECT * FROM store_auth WHERE id = ?').get(id);
  return jsonResponse({ store_auth: updated }, request);
}

// DELETE /api/store-auth
export async function DELETE(request: Request) {
  const db = getDb();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return errorResponse('缺少 id 参数', request, 400);
  }

  db.prepare('DELETE FROM store_auth WHERE id = ?').run(Number(id));
  
  // 检查是否还有其他授权
  const remaining = db.prepare('SELECT COUNT(*) as cnt FROM store_auth WHERE api_key != ""').get() as { cnt: number };
  if (remaining.cnt === 0) {
    // 没有授权了，停止自动同步
    stopAutoSync();
  }
  
  return jsonResponse({ success: true }, request);
}

// OPTIONS /api/store-auth - handle CORS preflight
export async function OPTIONS(request: Request) {
  return optionsResponse(request);
}
