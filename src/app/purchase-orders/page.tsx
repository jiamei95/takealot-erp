'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, X, Truck, Package, CheckCircle } from 'lucide-react';

interface POItem {
  id: number;
  product_id: number;
  quantity: number;
  product_name?: string;
  product_sku?: string;
}

interface PurchaseOrder {
  id: number;
  po_number: string;
  status: string;
  notes: string;
  created_at: string;
  items: POItem[];
}

interface Product {
  id: number;
  sku: string;
  name: string;
}

const statusConfig: Record<string, { label: string; icon: typeof Truck; color: string }> = {
  pending: { label: '\u5f85\u53d1\u8d27', icon: Package, color: '#f59e0b' },
  shipped: { label: '\u5df2\u53d1\u8d27', icon: Truck, color: '#3b82f6' },
  delivered: { label: '\u5df2\u9001\u8fbe', icon: CheckCircle, color: '#16a34a' },
};

export default function PurchaseOrdersPage() {
  const [pos, setPOs] = useState<PurchaseOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ po_number: '', notes: '' });
  const [items, setItems] = useState<Array<{ product_id: number; quantity: number }>>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchPOs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/purchase-orders');
      const json = await res.json();
      setPOs(json.purchase_orders);
      setTotal(json.total);
    } catch (err) {
      console.error('Failed to fetch POs:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch('/api/products?page_size=200')
      .then((r) => r.json())
      .then((d) => setProducts(d.products))
      .catch(console.error);
    fetchPOs();
  }, [fetchPOs]);

  const handleCreate = async () => {
    if (!form.po_number) {
      setError('PO \u7f16\u53f7\u4e3a\u5fc5\u586b\u9879');
      return;
    }
    if (items.length === 0) {
      setError('\u81f3\u5c11\u9700\u8981\u6dfb\u52a0\u4e00\u4e2a\u4ea7\u54c1');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          po_number: form.po_number,
          notes: form.notes,
          items,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || '\u521b\u5efa\u5931\u8d25');
        return;
      }
      setShowModal(false);
      setForm({ po_number: '', notes: '' });
      setItems([]);
      fetchPOs();
    } catch {
      setError('\u7f51\u7edc\u9519\u8bef');
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id: number, status: string) => {
    try {
      await fetch('/api/purchase-orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      fetchPOs();
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const deletePO = async (id: number) => {
    if (!confirm('\u786e\u5b9a\u8981\u5220\u9664\u8be5\u91c7\u8d2d\u8ba2\u5355\u5417\uff1f')) return;
    try {
      await fetch(`/api/purchase-orders?id=${id}`, { method: 'DELETE' });
      fetchPOs();
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  };

  const addItem = () => {
    setItems([...items, { product_id: 0, quantity: 1 }]);
  };

  const removeItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, field: 'product_id' | 'quantity', value: number) => {
    const newItems = [...items];
    newItems[idx] = { ...newItems[idx], [field]: value };
    setItems(newItems);
  };

  const getNextStatus = (current: string): string | null => {
    if (current === 'pending') return 'shipped';
    if (current === 'shipped') return 'delivered';
    return null;
  };

  return (
    <div>
      <div className="page-header">
        <h2>PO {'\u5efa\u5355\u7ba1\u7406'}</h2>
        <p>{'\u521b\u5efa\u548c\u8ddf\u8e2a\u53d1\u5f80 Takealot \u4ed3\u5e93\u7684\u91c7\u8d2d\u8ba2\u5355/\u8d27\u4ef6'}</p>
      </div>

      <div className="toolbar">
        <span style={{ fontSize: 12, color: '#64748b' }}>
          {'\u5171'} {total} {'\u4e2a\u91c7\u8d2d\u8ba2\u5355'}
        </span>
        <div style={{ flex: 1 }} />
        <button className="btn btn-primary" onClick={() => { setShowModal(true); setError(''); }}>
          <Plus size={14} />
          {'\u521b\u5efa PO'}
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
          {'\u52a0\u8f7d\u4e2d...'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {pos.map((po) => {
            const config = statusConfig[po.status] || statusConfig.pending;
            const StatusIcon = config.icon;
            const nextStatus = getNextStatus(po.status);

            return (
              <div className="card" key={po.id}>
                <div className="card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span
                      style={{
                        fontFamily: 'monospace',
                        fontWeight: 700,
                        fontSize: 14,
                        color: '#0f172a',
                      }}
                    >
                      {po.po_number}
                    </span>
                    <span
                      className={`badge badge-${po.status}`}
                      style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <StatusIcon size={12} />
                      {config.label}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {nextStatus && (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => updateStatus(po.id, nextStatus)}
                      >
                        {'\u6807\u8bb0\u4e3a'}{statusConfig[nextStatus].label}
                      </button>
                    )}
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => deletePO(po.id)}
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>
                <div className="card-body" style={{ padding: '12px 20px' }}>
                  {po.notes && (
                    <p style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
                      {po.notes}
                    </p>
                  )}
                  <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>
                    {'\u521b\u5efa\u65f6\u95f4'}: {new Date(po.created_at).toLocaleDateString('zh-CN')}
                  </div>
                  <table className="data-table" style={{ border: 'none' }}>
                    <thead>
                      <tr>
                        <th>{'\u4ea7\u54c1'}</th>
                        <th>SKU</th>
                        <th>{'\u6570\u91cf'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {po.items.map((item) => (
                        <tr key={item.id}>
                          <td>{item.product_name || '\u672a\u77e5'}</td>
                          <td style={{ fontFamily: 'monospace', fontSize: 12 }}>
                            {item.product_sku || '-'}
                          </td>
                          <td>{item.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
          {pos.length === 0 && (
            <div
              style={{
                textAlign: 'center',
                padding: 60,
                color: '#94a3b8',
                background: '#fff',
                borderRadius: 8,
                border: '1px solid #e2e8f0',
              }}
            >
              {'\u6682\u65e0\u91c7\u8d2d\u8ba2\u5355\u3002\u70b9\u51fb\u201c\u521b\u5efa PO\u201d\u5f00\u59cb\u4f7f\u7528\u3002'}
            </div>
          )}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{'\u521b\u5efa\u91c7\u8d2d\u8ba2\u5355'}</h3>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              {error && (
                <div
                  style={{
                    background: '#fef2f2',
                    color: '#dc2626',
                    padding: '8px 12px',
                    borderRadius: 6,
                    fontSize: 13,
                    marginBottom: 16,
                    border: '1px solid #fecaca',
                  }}
                >
                  {error}
                </div>
              )}
              <div className="form-group">
                <label>PO {'\u7f16\u53f7 *'}</label>
                <input
                  value={form.po_number}
                  onChange={(e) => setForm({ ...form, po_number: e.target.value })}
                  placeholder={'\u4f8b\u5982 PO-2025-004'}
                />
              </div>
              <div className="form-group">
                <label>{'\u5907\u6ce8'}</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder={'\u53ef\u9009\u5907\u6ce8\u4fe1\u606f...'}
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #e2e8f0',
                    borderRadius: 6,
                    fontSize: 13,
                    resize: 'vertical',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: '#334155' }}>
                  {'\u4ea7\u54c1\u660e\u7ec6'}
                </label>
                <button className="btn btn-secondary btn-sm" onClick={addItem}>
                  <Plus size={12} /> {'\u6dfb\u52a0\u4ea7\u54c1'}
                </button>
              </div>

              {items.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 100px 32px',
                    gap: 8,
                    marginBottom: 8,
                    alignItems: 'center',
                  }}
                >
                  <select
                    value={item.product_id}
                    onChange={(e) =>
                      updateItem(idx, 'product_id', parseInt(e.target.value))
                    }
                    style={{
                      padding: '8px 12px',
                      border: '1px solid #e2e8f0',
                      borderRadius: 6,
                      fontSize: 13,
                    }}
                  >
                    <option value={0}>{'\u9009\u62e9\u4ea7\u54c1...'}</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.sku} - {p.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) =>
                      updateItem(idx, 'quantity', parseInt(e.target.value) || 1)
                    }
                    placeholder={'\u6570\u91cf'}
                    style={{
                      padding: '8px 12px',
                      border: '1px solid #e2e8f0',
                      borderRadius: 6,
                      fontSize: 13,
                    }}
                  />
                  <button
                    onClick={() => removeItem(idx)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#94a3b8',
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
              {items.length === 0 && (
                <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: 16 }}>
                  {'\u6682\u672a\u6dfb\u52a0\u4ea7\u54c1\u3002\u70b9\u51fb\u201c\u6dfb\u52a0\u4ea7\u54c1\u201d\u5f00\u59cb\u3002'}
                </p>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                {'\u53d6\u6d88'}
              </button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>
                {saving ? '\u521b\u5efa\u4e2d...' : '\u521b\u5efa PO'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
