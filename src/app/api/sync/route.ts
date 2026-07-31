export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { jsonResponse, errorResponse, optionsResponse } from '@/lib/cors';
import { performSync, getSyncStatus, startAutoSync, stopAutoSync } from '@/lib/auto-sync';

// GET - 获取同步状态
export async function GET(request: NextRequest) {
  try {
    const status = getSyncStatus();
    const db = getDb();
    
    // 获取数据库统计
    const productsCount = (db.prepare('SELECT COUNT(*) as cnt FROM products').get() as { cnt: number }).cnt;
    const ordersCount = (db.prepare('SELECT COUNT(*) as cnt FROM orders').get() as { cnt: number }).cnt;
    
    // 获取 API Key 状态
    const auth = db.prepare('SELECT api_key, store_name FROM store_auth LIMIT 1').get() as { api_key: string; store_name: string } | undefined;
    
    return jsonResponse({
      success: true,
      data: {
        ...status,
        dbStats: {
          products: productsCount,
          orders: ordersCount,
        },
        apiKeyConfigured: !!auth?.api_key,
        storeName: auth?.store_name || null,
      },
    }, request);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return errorResponse(message, request, 500);
  }
}

// POST - 手动触发同步
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;
    
    if (action === 'start') {
      startAutoSync();
      return jsonResponse({ success: true, message: '自动同步已启动' }, request);
    }
    
    if (action === 'stop') {
      stopAutoSync();
      return jsonResponse({ success: true, message: '自动同步已停止' }, request);
    }
    
    if (action === 'sync') {
      const status = await performSync();
      return jsonResponse({ 
        success: !status.error, 
        message: status.error ? `同步完成但有错误: ${status.error}` : '同步成功',
        data: status,
      }, request);
    }
    
    return errorResponse('Invalid action. Use: start, stop, or sync', request, 400);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return errorResponse(message, request, 500);
  }
}

export async function OPTIONS(request: Request) {
  return optionsResponse(request);
}
