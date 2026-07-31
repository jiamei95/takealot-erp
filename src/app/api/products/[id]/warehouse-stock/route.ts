export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { jsonResponse, errorResponse, optionsResponse } from '@/lib/cors';

// GET - 获取产品的仓库库存详情
export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const sku = searchParams.get('sku');
    const productId = searchParams.get('product_id');

    if (!sku && !productId) {
      return errorResponse('Missing sku or product_id parameter', request, 400);
    }

    // 获取产品基本信息
    let product;
    if (productId) {
      product = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(productId));
    } else {
      product = db.prepare('SELECT * FROM products WHERE sku = ?').get(sku);
    }

    if (!product) {
      return errorResponse('Product not found', request, 404);
    }

    // 获取仓库库存详情（从 product_warehouse_stock 表）
    const warehouseStock = db.prepare(`
      SELECT * FROM product_warehouse_stock 
      WHERE product_id = ? 
      ORDER BY warehouse_name
    `).all((product as any).id);

    return jsonResponse({
      success: true,
      data: {
        product,
        warehouse_stock: warehouseStock,
      },
    }, request);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return errorResponse(message, request, 500);
  }
}

export async function OPTIONS(request: Request) {
  return optionsResponse(request);
}
