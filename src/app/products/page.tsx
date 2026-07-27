'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Search, X } from 'lucide-react';

interface Product {
  id: number;
  sku: string;
  name: string;
  cost_price: number;
  selling_price: number;
  image_url: string;
  takealot_product_id: string;
  created_at: string;
}

function formatZAR(amount: number): string {
  return `R ${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const emptyForm = {
  sku: '',
  name: '',
  cost_price: '',
  selling_price: '',
  image_url: '',
  takealot_product_id: '',
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      const res = await fetch(`/api/products?${params}`);
      const json = await res.json();
      setProducts(json.products);
      setTotal(json.total);
    } catch (err) {
      console.error('Failed to fetch products:', err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const openCreate = () => {
    setForm(emptyForm);
    setEditingId(null);
    setError('');
    setShowModal(true);
  };

  const openEdit = (p: Product) => {
    setForm({
      sku: p.sku,
      name: p.name,
      cost_price: String(p.cost_price),
      selling_price: String(p.selling_price),
      image_url: p.image_url || '',
      takealot_product_id: p.takealot_product_id || '',
    });
    setEditingId(p.id);
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.sku || !form.name) {
      setError('SKU and Name are required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...(editingId ? { id: editingId } : {}),
        sku: form.sku,
        name: form.name,
        cost_price: parseFloat(form.cost_price) || 0,
        selling_price: parseFloat(form.selling_price) || 0,
        image_url: form.image_url,
        takealot_product_id: form.takealot_product_id,
      };

      const url = editingId ? '/api/products' : '/api/products';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Failed to save');
        return;
      }
      setShowModal(false);
      fetchProducts();
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      await fetch(`/api/products?id=${id}`, { method: 'DELETE' });
      fetchProducts();
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2>Product Management</h2>
        <p>Manage your product catalog and Takealot store matching</p>
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
            placeholder="Search by SKU or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 32, width: 260 }}
          />
        </div>
        <span style={{ fontSize: 12, color: '#64748b' }}>
          {total} products
        </span>
        <div style={{ flex: 1 }} />
        <button className="btn btn-primary" onClick={openCreate}>
          <Plus size={14} />
          New Product
        </button>
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
                  <th>SKU</th>
                  <th>Product Name</th>
                  <th>Cost Price</th>
                  <th>Selling Price</th>
                  <th>Margin</th>
                  <th>Takealot ID</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const margin =
                    p.selling_price > 0
                      ? (
                          ((p.selling_price - p.cost_price) / p.selling_price) *
                          100
                        ).toFixed(1)
                      : '0.0';
                  return (
                    <tr key={p.id}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 12 }}>
                        {p.sku}
                      </td>
                      <td style={{ fontWeight: 500 }}>{p.name}</td>
                      <td>{formatZAR(p.cost_price)}</td>
                      <td>{formatZAR(p.selling_price)}</td>
                      <td
                        className={
                          parseFloat(margin) >= 20 ? 'text-profit' : 'text-loss'
                        }
                      >
                        {margin}%
                      </td>
                      <td>
                        {p.takealot_product_id ? (
                          <span
                            style={{
                              fontFamily: 'monospace',
                              fontSize: 12,
                              background: '#dbeafe',
                              padding: '2px 6px',
                              borderRadius: 4,
                              color: '#1e40af',
                            }}
                          >
                            {p.takealot_product_id}
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: 12 }}>
                            Not linked
                          </span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => openEdit(p)}
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDelete(p.id)}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingId ? 'Edit Product' : 'New Product'}</h3>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#64748b',
                }}
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
                <label>SKU *</label>
                <input
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  placeholder="e.g. TK-EL-001"
                />
              </div>
              <div className="form-group">
                <label>Product Name *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Product name"
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label>Cost Price (ZAR)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.cost_price}
                    onChange={(e) =>
                      setForm({ ...form, cost_price: e.target.value })
                    }
                    placeholder="0.00"
                  />
                </div>
                <div className="form-group">
                  <label>Selling Price (ZAR)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.selling_price}
                    onChange={(e) =>
                      setForm({ ...form, selling_price: e.target.value })
                    }
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Image URL</label>
                <input
                  value={form.image_url}
                  onChange={(e) =>
                    setForm({ ...form, image_url: e.target.value })
                  }
                  placeholder="https://..."
                />
              </div>
              <div className="form-group">
                <label>Takealot Product ID</label>
                <input
                  value={form.takealot_product_id}
                  onChange={(e) =>
                    setForm({ ...form, takealot_product_id: e.target.value })
                  }
                  placeholder="e.g. TL-10234"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
