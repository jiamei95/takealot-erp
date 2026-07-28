import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { corsHeaders } from '@/lib/cors';

export const dynamic = 'force-dynamic';

function jsonResponse(data: any, request: Request, status = 200) {
  const origin = request.headers.get('origin');
  return NextResponse.json(data, { status, headers: corsHeaders(origin) });
}

function errorResponse(error: string, request: Request, status = 400) {
  const origin = request.headers.get('origin');
  return NextResponse.json({ error }, { status, headers: corsHeaders(origin) });
}

// 获取 PO 详情
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = getDb();
    const po = db.prepare(`
      SELECT po.*, 
        COUNT(DISTINCT poi.id) as total_items,
        COALESCE(SUM(poi.quantity), 0) as total_quantity
      FROM purchase_orders po
      LEFT JOIN purchase_order_items poi ON po.id = poi.po_id
      WHERE po.id = ?
      GROUP BY po.id
    `).get(params.id) as any;

    if (!po) {
      return errorResponse('PO 单不存在', request, 404);
    }

    // 获取产品明细
    const items = db.prepare(`
      SELECT * FROM purchase_order_items WHERE po_id = ?
    `).all(params.id);

    return jsonResponse({ ...po, items }, request);
  } catch (error: any) {
    return errorResponse(error.message || '服务器错误', request, 500);
  }
}

// 更新 PO 单（关联平台 PO、更新状态）
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = getDb();
    const body = await request.json();
    const { status, platform_shipment_id, platform_response } = body;

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

    db.prepare(`
      UPDATE purchase_orders 
      SET status = COALESCE(?, status),
          platform_shipment_id = COALESCE(?, platform_shipment_id),
          platform_response = COALESCE(?, platform_response),
          updated_at = ?
      WHERE id = ?
    `).run(
      status || null,
      platform_shipment_id || null,
      platform_response || null,
      now,
      params.id,
    );

    return jsonResponse({ success: true }, request);
  } catch (error: any) {
    return errorResponse(error.message || '服务器错误', request, 500);
  }
}

// 删除 PO 单
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = getDb();
    
    // 先删除产品明细
    db.prepare('DELETE FROM purchase_order_items WHERE po_id = ?').run(params.id);
    // 再删除 PO 单
    db.prepare('DELETE FROM purchase_orders WHERE id = ?').run(params.id);

    return jsonResponse({ success: true }, request);
  } catch (error: any) {
    return errorResponse(error.message || '服务器错误', request, 500);
  }
}
