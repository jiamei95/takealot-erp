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
  pending: { label: 'Pending', icon: Package, color: '#f59e0b' },
  shipped: { label: 'Shipped', icon: Truck, color: '#3b82f6' },
  delivered: { label: 'Delivered', icon: CheckCircle, color: '#16a34a' },
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
      setError('PO number is required');
      return;
    }
    if (items.length === 0) {
      setError('At least one item is required');
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
        setError(json.error || 'Failed to create');
        return;
      }
      setShowModal(false);
      setForm({ po_number: '', notes: '' });
      setItems([]);
      fetchPOs();
    } catch {
      setError('Network error');
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
    if (!confirm('Delete this purchase order?')) return;
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
        <h2>PO Management</h2>
        <p>Create and track purchase orders for Takealot warehouse shipments</p>
      </div>

      <div className="toolbar">
        <span style={{ fontSize: 12, color: '#64748b' }}>
          {total} purchase orders
        </span>
        <div style={{ flex: 1 }} />
        <button className="btn btn-primary" onClick={() => { setShowModal(true); setError(''); }}>
          <Plus size={14} />
          Create PO
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
          Loading...
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
                        Mark as {statusConfig[nextStatus].label}
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
                    Created: {new Date(po.created_at).toLocaleDateString('en-ZA')}
                  </div>
                  <table className="data-table" style={{ border: 'none' }}>
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>SKU</th>
                        <th>Quantity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {po.items.map((item) => (
                        <tr key={item.id}>
                          <td>{item.product_name || 'Unknown'}</td>
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
              No purchase orders yet. Click &quot;Create PO&quot; to get started.
            </div>
          )}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create Purchase Order</h3>
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
                <label>PO Number *</label>
                <input
                  value={form.po_number}
                  onChange={(e) => setForm({ ...form, po_number: e.target.value })}
                  placeholder="e.g. PO-2025-004"
                />
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Optional notes..."
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
                  Items
                </label>
                <button className="btn btn-secondary btn-sm" onClick={addItem}>
                  <Plus size={12} /> Add Item
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
                    <option value={0}>Select product...</option>
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
                    placeholder="Qty"
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
                  No items added. Click &quot;Add Item&quot; to add products.
                </p>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>
                {saving ? 'Creating...' : 'Create PO'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
