'use client';

import { useEffect, useState, useCallback } from 'react';
import { Search } from 'lucide-react';

interface Order {
  id: number;
  order_number: string;
  order_date: string;
  product_name: string;
  product_sku: string;
  quantity: number;
  selling_price: number;
  cost_price: number;
  platform_commission: number;
  payment_fee: number;
  storage_fee: number;
  other_fees: number;
  profit: number;
  status: string;
  store_name: string;
}

const statusLabels: Record<string, string> = {
  completed: '\u5df2\u5b8c\u6210',
  shipped: '\u5df2\u53d1\u8d27',
  pending: '\u5f85\u5904\u7406',
  cancelled: '\u5df2\u53d6\u6d88',
};

function formatZAR(amount: number): string {
  return `R ${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [store, setStore] = useState('');
  const [stores, setStores] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const pageSize = 30;

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
      });
      if (search) params.set('search', search);
      if (status) params.set('status', status);
      if (store) params.set('store', store);
      const res = await fetch(`/api/orders?${params}`);
      const json = await res.json();
      setOrders(json.orders);
      setTotal(json.total);
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      setLoading(false);
    }
  }, [page, search, status, store]);

  useEffect(() => {
    fetch('/api/stores')
      .then((r) => r.json())
      .then((d) => setStores(d.stores.map((s: { name: string }) => s.name)))
      .catch(console.error);
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div>
      <div className="page-header">
        <h2>{'\u8ba2\u5355\u7ba1\u7406'}</h2>
        <p>{'\u67e5\u770b\u548c\u7ba1\u7406\u6240\u6709 Takealot \u5e73\u53f0\u8ba2\u5355'}</p>
      </div>

      <div className="toolbar">
        <div style={{ position: 'relative' }}>
          <Search
            size={14}
            style={{
              position: 'absolute',
              left: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#94a3b8',
            }}
          />
          <input
            type="text"
            placeholder={'\u641c\u7d22\u8ba2\u5355\u53f7\u6216\u4ea7\u54c1\u540d...'}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            style={{ paddingLeft: 32, width: 240 }}
          />
        </div>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">{'\u6240\u6709\u72b6\u6001'}</option>
          <option value="completed">{'\u5df2\u5b8c\u6210'}</option>
          <option value="shipped">{'\u5df2\u53d1\u8d27'}</option>
          <option value="pending">{'\u5f85\u5904\u7406'}</option>
          <option value="cancelled">{'\u5df2\u53d6\u6d88'}</option>
        </select>
        <select
          value={store}
          onChange={(e) => {
            setStore(e.target.value);
            setPage(1);
          }}
        >
          <option value="">{'\u6240\u6709\u5e97\u94fa'}</option>
          {stores.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <span style={{ fontSize: 12, color: '#64748b' }}>
          {'\u5171'} {total} {'\u4e2a\u8ba2\u5355'}
        </span>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
          {'\u52a0\u8f7d\u4e2d...'}
        </div>
      ) : (
        <div className="card">
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{'\u8ba2\u5355\u53f7'}</th>
                  <th>{'\u4e0b\u5355\u65f6\u95f4'}</th>
                  <th>{'\u4ea7\u54c1'}</th>
                  <th>SKU</th>
                  <th>{'\u6570\u91cf'}</th>
                  <th>{'\u552e\u4ef7'}</th>
                  <th>{'\u6210\u672c'}</th>
                  <th>{'\u5e73\u53f0\u4f63\u91d1'}</th>
                  <th>{'\u652f\u4ed8\u624b\u7eed\u8d39'}</th>
                  <th>{'\u4ed3\u50a8\u8d39'}</th>
                  <th>{'\u5176\u4ed6'}</th>
                  <th>{'\u5229\u6da6'}</th>
                  <th>{'\u72b6\u6001'}</th>
                  <th>{'\u5e97\u94fa'}</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: 12 }}>
                      {o.order_number}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{o.order_date}</td>
                    <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {o.product_name}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{o.product_sku}</td>
                    <td>{o.quantity}</td>
                    <td>{formatZAR(o.selling_price)}</td>
                    <td>{formatZAR(o.cost_price)}</td>
                    <td>{formatZAR(o.platform_commission)}</td>
                    <td>{formatZAR(o.payment_fee)}</td>
                    <td>{formatZAR(o.storage_fee)}</td>
                    <td>{formatZAR(o.other_fees)}</td>
                    <td className={o.profit >= 0 ? 'text-profit' : 'text-loss'}>
                      {formatZAR(o.profit)}
                    </td>
                    <td>
                      <span className={`badge badge-${o.status}`}>
                        {statusLabels[o.status] || o.status}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: '#64748b' }}>{o.store_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div
              style={{
                padding: '12px 16px',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: 12, color: '#64748b' }}>
                {'\u7b2c'} {page} {'\u9875 / \u5171'} {totalPages} {'\u9875'}
              </span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  {'\u4e0a\u4e00\u9875'}
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  {'\u4e0b\u4e00\u9875'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
