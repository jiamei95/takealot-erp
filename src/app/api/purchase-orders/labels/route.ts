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

// 获取标签下载信息
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const poId = searchParams.get('po_id');

    if (!poId) {
      return errorResponse('缺少 po_id 参数', request);
    }

    const db = getDb();
    const po = db.prepare(`
      SELECT po.*, sa.api_key, sa.api_base_url
      FROM purchase_orders po
      LEFT JOIN store_auth sa ON po.store_id = sa.id
      WHERE po.id = ?
    `).get(poId) as any;

    if (!po) {
      return errorResponse('PO 单不存在', request, 404);
    }

    // 检查是否已关联平台 PO
    if (!po.platform_shipment_id) {
      return errorResponse('该 PO 单尚未关联 Takealot 平台 PO，请先同步数据', request);
    }

    // 返回标签下载信息
    // 注意：Takealot API 可能不直接支持标签下载，这里提供跳转到后台的链接
    const takealotUrl = `https://seller.takealot.com/seller/shipments/${po.platform_shipment_id}`;

    return jsonResponse({
      po_id: po.id,
      po_number: po.po_number,
      platform_shipment_id: po.platform_shipment_id,
      label_download_url: takealotUrl,
      note: '点击链接跳转到 Takealot 后台下载标签',
    }, request);
  } catch (error: any) {
    return errorResponse(error.message || '服务器错误', request, 500);
  }
}
