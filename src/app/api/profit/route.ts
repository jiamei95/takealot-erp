import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(request.url);
  const store = searchParams.get('store') || '';

  let where = "WHERE o.status != 'cancelled'";
  const params: (string | number)[] = [];

  if (store) {
    where += ' AND o.store_name = ?';
    params.push(store);
  }

  const stats = db.prepare(`
    SELECT
      COUNT(*) as total_orders,
      SUM(o.selling_price * o.quantity) as total_sales,
      SUM(o.profit) as total_profit,
      SUM(o.platform_commission) as total_commission,
      SUM(o.payment_fee) as total_payment_fees,
      SUM(o.storage_fee) as total_storage_fees,
      SUM(o.cost_price * o.quantity) as total_cost
    FROM orders o
    ${where}
  `).get(...params) as Record<string, number | null>;

  const totalSales = stats.total_sales || 0;
  const totalProfit = stats.total_profit || 0;
  const profitMargin = totalSales > 0 ? +((totalProfit / totalSales) * 100).toFixed(2) : 0;

  const storeStats = db.prepare(`
    SELECT
      o.store_name,
      COUNT(*) as order_count,
      SUM(o.selling_price * o.quantity) as sales,
      SUM(o.profit) as profit
    FROM orders o
    ${where}
    GROUP BY o.store_name
    ORDER BY sales DESC
  `).all(...params);

  return NextResponse.json({
    total_orders: stats.total_orders || 0,
    total_sales: +totalSales.toFixed(2),
    total_profit: +totalProfit.toFixed(2),
    profit_margin: profitMargin,
    total_commission: +(stats.total_commission || 0).toFixed(2),
    total_payment_fees: +(stats.total_payment_fees || 0).toFixed(2),
    total_storage_fees: +(stats.total_storage_fees || 0).toFixed(2),
    total_cost: +(stats.total_cost || 0).toFixed(2),
    store_stats: storeStats,
  });
}
