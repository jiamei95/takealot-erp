'use client';

import { useEffect, useState, useCallback } from 'react';
import { TrendingUp, DollarSign, ShoppingBag, Percent } from 'lucide-react';

interface ProfitData {
  total_orders: number;
  total_sales: number;
  total_profit: number;
  profit_margin: number;
  total_commission: number;
  total_payment_fees: number;
  total_storage_fees: number;
  total_cost: number;
  store_stats: Array<{
    store_name: string;
    order_count: number;
    sales: number;
    profit: number;
  }>;
}

interface StoresData {
  stores: Array<{ id: number; name: string }>;
}

function formatZAR(amount: number): string {
  return `R ${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function DashboardPage() {
  const [data, setData] = useState<ProfitData | null>(null);
  const [stores, setStores] = useState<StoresData['stores']>([]);
  const [selectedStore, setSelectedStore] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedStore) params.set('store', selectedStore);
      const res = await fetch(`/api/profit?${params}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error('Failed to fetch profit data:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedStore]);

  useEffect(() => {
    fetch('/api/stores')
      .then((r) => r.json())
      .then((d: StoresData) => setStores(d.stores))
      .catch(console.error);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div>
      <div className="page-header">
        <h2>Profit Analysis</h2>
        <p>Overview of your Takealot store performance and profitability</p>
      </div>

      <div className="toolbar">
        <select
          value={selectedStore}
          onChange={(e) => setSelectedStore(e.target.value)}
        >
          <option value="">All Stores</option>
          {stores.map((s) => (
            <option key={s.id} value={s.name}>
              {s.name}
            </option>
          ))}
        </select>
        <button className="btn btn-secondary btn-sm" onClick={fetchData}>
          Refresh
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
          Loading...
        </div>
      ) : data ? (
        <>
          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-label">
                <ShoppingBag size={14} style={{ display: 'inline', marginRight: 4 }} />
                Total Orders
              </div>
              <div className="stat-value">{data.total_orders.toLocaleString()}</div>
              <div className="stat-sub">All non-cancelled orders</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">
                <DollarSign size={14} style={{ display: 'inline', marginRight: 4 }} />
                Total Sales
              </div>
              <div className="stat-value">{formatZAR(data.total_sales)}</div>
              <div className="stat-sub">Gross revenue (ZAR)</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">
                <TrendingUp size={14} style={{ display: 'inline', marginRight: 4 }} />
                Total Profit
              </div>
              <div className={`stat-value ${data.total_profit >= 0 ? 'profit' : 'loss'}`}>
                {formatZAR(data.total_profit)}
              </div>
              <div className="stat-sub">After all deductions</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">
                <Percent size={14} style={{ display: 'inline', marginRight: 4 }} />
                Profit Margin
              </div>
              <div className={`stat-value ${data.profit_margin >= 0 ? 'profit' : 'loss'}`}>
                {data.profit_margin}%
              </div>
              <div className="stat-sub">Profit / Revenue ratio</div>
            </div>
          </div>

          <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="stat-card">
              <div className="stat-label">Platform Commission</div>
              <div className="stat-value" style={{ fontSize: 20 }}>
                {formatZAR(data.total_commission)}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Payment Fees</div>
              <div className="stat-value" style={{ fontSize: 20 }}>
                {formatZAR(data.total_payment_fees)}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Storage Fees</div>
              <div className="stat-value" style={{ fontSize: 20 }}>
                {formatZAR(data.total_storage_fees)}
              </div>
            </div>
          </div>

          <div className="card" style={{ marginTop: 24 }}>
            <div className="card-header">
              <h3>Store Performance Breakdown</h3>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Store Name</th>
                  <th>Orders</th>
                  <th>Sales (ZAR)</th>
                  <th>Profit (ZAR)</th>
                  <th>Margin</th>
                </tr>
              </thead>
              <tbody>
                {data.store_stats.map(
                  (
                    store: {
                      store_name: string;
                      order_count: number;
                      sales: number;
                      profit: number;
                    },
                    idx: number
                  ) => {
                    const margin =
                      store.sales > 0
                        ? ((store.profit / store.sales) * 100).toFixed(1)
                        : '0.0';
                    return (
                      <tr key={idx}>
                        <td style={{ fontWeight: 500 }}>{store.store_name}</td>
                        <td>{store.order_count.toLocaleString()}</td>
                        <td>{formatZAR(store.sales)}</td>
                        <td
                          className={store.profit >= 0 ? 'text-profit' : 'text-loss'}
                        >
                          {formatZAR(store.profit)}
                        </td>
                        <td
                          className={
                            parseFloat(margin) >= 0 ? 'text-profit' : 'text-loss'
                          }
                        >
                          {margin}%
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}
