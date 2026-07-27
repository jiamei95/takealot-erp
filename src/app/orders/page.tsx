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
        <h2>Order Management</h2>
        <p>View and manage all Takealot platform orders</p>
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
            placeholder="Search order # or product..."
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
          <option value="">All Status</option>
          <option value="completed">Completed</option>
          <option value="shipped">Shipped</option>
          <option value="pending">Pending</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select
          value={store}
          onChange={(e) => {
            setStore(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All Stores</option>
          {stores.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <span style={{ fontSize: 12, color: '#64748b' }}>
          {total} orders found
        </span>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
          Loading...
        </div>
      ) : (
        <div className="card">
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Date</th>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Qty</th>
                  <th>Sell Price</th>
                  <th>Cost</th>
                  <th>Commission</th>
                  <th>Pay Fee</th>
                  <th>Storage</th>
                  <th>Other</th>
                  <th>Profit</th>
                  <th>Status</th>
                  <th>Store</th>
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
                      <span className={`badge badge-${o.status}`}>{o.status}</span>
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
                Page {page} of {totalPages}
              </span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
