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

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';

    let query = `
      SELECT po.*, 
        COUNT(DISTINCT poi.id) as total_items,
        COALESCE(SUM(poi.quantity), 0) as total_quantity
      FROM purchase_orders po
      LEFT JOIN purchase_order_items poi ON po.id = poi.po_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (search) {
      query += ` AND po.po_number LIKE ?`;
      params.push(`%${search}%`);
    }
    if (status) {
      query += ` AND po.status = ?`;
      params.push(status);
    }

    query += ` GROUP BY po.id ORDER BY po.created_at DESC LIMIT 100`;

    const orders = db.prepare(query).all(...params);
    return jsonResponse({ purchase_orders: orders }, request);
  } catch (error: any) {
    return errorResponse(error.message || '服务器错误', request, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const { warehouse, notes, items } = body;

    if (!warehouse) {
      return errorResponse('请选择目的地仓库', request);
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return errorResponse('至少需要添加一个产品', request);
    }

    // 自动生成 PO 编号
    const lastPO = db.prepare('SELECT po_number FROM purchase_orders ORDER BY id DESC LIMIT 1').get() as any;
    let poNumber = 'PO-0001';
    if (lastPO) {
      const lastNum = parseInt(lastPO.po_number.replace('PO-', ''));
      poNumber = `PO-${String(lastNum + 1).padStart(4, '0')}`;
    }

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const result = db.prepare(`
      INSERT INTO purchase_orders (po_number, destination_warehouse, total_items, total_quantity, status, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)
    `).run(
      poNumber,
      warehouse,
      items.length,
      items.reduce((sum: number, i: any) => sum + i.quantity, 0),
      notes || '',
      now,
      now,
    );

    const poId = result.lastInsertRowid;

    // 添加产品明细
    const insertItem = db.prepare(`
      INSERT INTO purchase_order_items (po_id, product_id, sku, product_name, quantity, cost_price, subtotal)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of items) {
      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id) as any;
      if (product) {
        insertItem.run(
          poId,
          item.product_id,
          product.sku,
          product.name,
          item.quantity,
          product.cost_price,
          product.cost_price * item.quantity,
        );
      }
    }

    return jsonResponse({ success: true, po_number: poNumber, id: poId }, request);
  } catch (error: any) {
    return errorResponse(error.message || '服务器错误', request, 500);
  }
}
