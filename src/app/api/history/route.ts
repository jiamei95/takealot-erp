import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('start') || '';
  const endDate = searchParams.get('end') || '';
  const dimension = searchParams.get('dimension') || 'day';
  const store = searchParams.get('store') || '';

  let where = "WHERE o.status != 'cancelled'";
  const params: (string | number)[] = [];

  if (startDate) {
    where += ' AND o.order_date >= ?';
    params.push(startDate);
  }
  if (endDate) {
    where += ' AND o.order_date <= ?';
    params.push(endDate);
  }
  if (store) {
    where += ' AND o.store_name = ?';
    params.push(store);
  }

  let groupBy: string;
  switch (dimension) {
    case 'week':
      groupBy = "strftime('%Y-W%W', o.order_date)";
      break;
    case 'month':
      groupBy = "strftime('%Y-%m', o.order_date)";
      break;
    default:
      groupBy = "o.order_date";
  }

  const trends = db.prepare(`
    SELECT
      ${groupBy} as period,
      COUNT(*) as order_count,
      SUM(o.quantity) as quantity,
      SUM(o.selling_price * o.quantity) as sales,
      SUM(o.profit) as profit,
      SUM(o.platform_commission) as commission,
      SUM(o.cost_price * o.quantity) as cost
    FROM orders o
    ${where}
    GROUP BY ${groupBy}
    ORDER BY period ASC
  `).all(...params);

  const summary = db.prepare(`
    SELECT
      COUNT(*) as total_orders,
      SUM(o.quantity) as total_quantity,
      SUM(o.selling_price * o.quantity) as total_sales,
      SUM(o.profit) as total_profit
    FROM orders o
    ${where}
  `).get(...params) as Record<string, number | null>;

  return jsonResponse({
    trends,
    summary: {
      total_orders: summary.total_orders || 0,
      total_quantity: summary.total_quantity || 0,
      total_sales: +(summary.total_sales || 0).toFixed(2),
      total_profit: +(summary.total_profit || 0).toFixed(2),
    },
  }, request);
}

export async function OPTIONS(request: Request) {
  return optionsResponse(request);
}
