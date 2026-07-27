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
        <h2>{'\u5229\u6da6\u5206\u6790'}</h2>
        <p>{'\u67e5\u770b\u60a8\u7684 Takealot \u5e97\u94fa\u8fd0\u8425\u4e0e\u76c8\u5229\u6982\u51b5'}</p>
      </div>

      <div className="toolbar">
        <select
          value={selectedStore}
          onChange={(e) => setSelectedStore(e.target.value)}
        >
          <option value="">{'\u6240\u6709\u5e97\u94fa'}</option>
          {stores.map((s) => (
            <option key={s.id} value={s.name}>
              {s.name}
            </option>
          ))}
        </select>
        <button className="btn btn-secondary btn-sm" onClick={fetchData}>
          {'\u5237\u65b0'}
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
          {'\u52a0\u8f7d\u4e2d...'}
        </div>
      ) : data ? (
        <>
          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-label">
                <ShoppingBag size={14} style={{ display: 'inline', marginRight: 4 }} />
                {'\u603b\u8ba2\u5355\u6570'}
              </div>
              <div className="stat-value">{data.total_orders.toLocaleString()}</div>
              <div className="stat-sub">{'\u6240\u6709\u975e\u53d6\u6d88\u8ba2\u5355'}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">
                <DollarSign size={14} style={{ display: 'inline', marginRight: 4 }} />
                {'\u603b\u9500\u552e\u989d'}
              </div>
              <div className="stat-value">{formatZAR(data.total_sales)}</div>
              <div className="stat-sub">{'\u603b\u8425\u6536 (ZAR)'}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">
                <TrendingUp size={14} style={{ display: 'inline', marginRight: 4 }} />
                {'\u603b\u5229\u6da6'}
              </div>
              <div className={`stat-value ${data.total_profit >= 0 ? 'profit' : 'loss'}`}>
                {formatZAR(data.total_profit)}
              </div>
              <div className="stat-sub">{'\u6263\u9664\u6240\u6709\u8d39\u7528\u540e'}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">
                <Percent size={14} style={{ display: 'inline', marginRight: 4 }} />
                {'\u5229\u6da6\u7387'}
              </div>
              <div className={`stat-value ${data.profit_margin >= 0 ? 'profit' : 'loss'}`}>
                {data.profit_margin}%
              </div>
              <div className="stat-sub">{'\u5229\u6da6 / \u8425\u6536 \u6bd4\u4f8b'}</div>
            </div>
          </div>

          <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="stat-card">
              <div className="stat-label">{'\u5e73\u53f0\u4f63\u91d1'}</div>
              <div className="stat-value" style={{ fontSize: 20 }}>
                {formatZAR(data.total_commission)}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">{'\u652f\u4ed8\u624b\u7eed\u8d39'}</div>
              <div className="stat-value" style={{ fontSize: 20 }}>
                {formatZAR(data.total_payment_fees)}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">{'\u4ed3\u50a8\u8d39'}</div>
              <div className="stat-value" style={{ fontSize: 20 }}>
                {formatZAR(data.total_storage_fees)}
              </div>
            </div>
          </div>

          <div className="card" style={{ marginTop: 24 }}>
            <div className="card-header">
              <h3>{'\u5e97\u94fa\u4e1a\u7ee9\u660e\u7ec6'}</h3>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{'\u5e97\u94fa\u540d\u79f0'}</th>
                  <th>{'\u8ba2\u5355\u6570'}</th>
                  <th>{'\u9500\u552e\u989d (ZAR)'}</th>
                  <th>{'\u5229\u6da6 (ZAR)'}</th>
                  <th>{'\u5229\u6da6\u7387'}</th>
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
