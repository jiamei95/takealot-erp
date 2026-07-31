'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Search, X, Package, RefreshCw } from 'lucide-react';

interface Product {
  id: number;
  sku: string;
  name: string;
  cost_price: number;
  selling_price: number;
  image_url: string;
  takealot_product_id: string;
  stock_quantity: number;
  stock_available: number;
  created_at: string;
}

interface WarehouseStock {
  id: number;
  warehouse_id: string;
  warehouse_name: string;
  quantity: number;
  available: number;
  reserved: number;
  in_transit: number;
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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [error, setError] = useState('');
  const [warehouseStock, setWarehouseStock] = useState<Map<number, WarehouseStock[]>>(new Map());
  const [selectedProduct, setSelectedProduct] = useState<number | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);

  const CACHE_DURATION = 5 * 60 * 1000; // 5 分钟缓存

  const fetchProducts = useCallback(async (forceRefresh = false) => {
    const now = Date.now();
    if (!forceRefresh && lastFetchTime > 0 && (now - lastFetchTime) < CACHE_DURATION) {
      return; // 使用缓存
    }
    
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      params.set('page', page.toString());
      params.set('page_size', pageSize.toString());
      const res = await fetch(`/api/products?${params}`);
      const json = await res.json();
      setProducts(json.products);
      setTotal(json.total);
      
      // 从 API 返回的数据中提取仓库库存
      const warehouseMap = new Map<number, WarehouseStock[]>();
      for (const product of json.products) {
        if (product.warehouse_stock && product.warehouse_stock.length > 0) {
          warehouseMap.set(product.id, product.warehouse_stock);
        }
      }
      setWarehouseStock(warehouseMap);
      setLastFetchTime(now);
    } catch (err) {
      console.error('Failed to fetch products:', err);
    } finally {
      setLoading(false);
    }
  }, [search, page, pageSize, lastFetchTime]);

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
      setError('SKU \u548c\u540d\u79f0\u4e3a\u5fc5\u586b\u9879');
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

      const url = '/api/products';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || '\u4fdd\u5b58\u5931\u8d25');
        return;
      }
      setShowModal(false);
      fetchProducts();
    } catch {
      setError('\u7f51\u7edc\u9519\u8bef');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('\u786e\u5b9a\u8981\u5220\u9664\u8be5\u4ea7\u54c1\u5417\uff1f')) return;
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
        <h2>{'\u4ea7\u54c1\u7ba1\u7406'}</h2>
        <p>{'\u7ba1\u7406\u4ea7\u54c1\u76ee\u5f55\u53ca Takealot \u5e97\u94fa\u4ea7\u54c1\u5339\u914d'}</p>
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
            placeholder="按 SKU 或名称搜索..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 32, width: 260 }}
          />
        </div>
        <span style={{ fontSize: 13, color: '#16a34a', fontWeight: 600 }}>
          共 {total} 个产品
        </span>
        <div style={{ flex: 1 }} />
        <button 
          className="btn btn-secondary" 
          onClick={() => fetchProducts(true)}
          title="刷新数据"
        >
          <RefreshCw size={14} />
          刷新
        </button>
        <button className="btn btn-primary" onClick={openCreate}>
          <Plus size={14} />
          新建产品
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
          {'\u52a0\u8f7d\u4e2d...'}
        </div>
      ) : products.length === 0 ? (
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
          <Package size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
          <p>{'\u6682\u65e0\u4ea7\u54c1\u6570\u636e'}</p>
          <p style={{ fontSize: 12, marginTop: 4 }}>
            {'\u8bf7\u5148\u5728\u300c\u5e97\u94fa\u6388\u6743\u300d\u9875\u9762\u540c\u6b65 Takealot \u4ea7\u54c1\u6570\u636e\uff0c\u6216\u70b9\u51fb\u201c\u65b0\u5efa\u4ea7\u54c1\u201d\u624b\u52a8\u6dfb\u52a0'}
          </p>
        </div>
      ) : (
        <div className="card">
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{'\u56fe\u7247'}</th>
                  <th>SKU</th>
                  <th>{'\u4ea7\u54c1\u540d\u79f0'}</th>
                  <th>{'\u5e93\u5b58'}</th>
                  <th>{'\u6210\u672c\u4ef7'}</th>
                  <th>{'\u552e\u4ef7'}</th>
                  <th>{'\u5229\u6da6\u7387'}</th>
                  <th>Takealot ID</th>
                  <th>{'\u64cd\u4f5c'}</th>
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
                      <td>
                        {p.image_url ? (
                          <img
                            src={p.image_url}
                            alt={p.name}
                            style={{
                              width: 40,
                              height: 40,
                              objectFit: 'cover',
                              borderRadius: 4,
                              border: '1px solid #e2e8f0',
                            }}
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 40,
                              height: 40,
                              background: '#f1f5f9',
                              borderRadius: 4,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#94a3b8',
                              fontSize: 10,
                            }}
                          >
                            {'\u65e0\u56fe'}
                          </div>
                        )}
                      </td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 12 }}>
                        {p.sku}
                      </td>
                      <td style={{ fontWeight: 500, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.name}
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ fontSize: 12, fontWeight: 600 }}>
                            {p.stock_available ?? 0}
                          </span>
                          <span style={{ fontSize: 10, color: '#64748b' }}>
                            可售
                          </span>
                          {warehouseStock.get(p.id) && warehouseStock.get(p.id)!.length > 0 && (
                            <div style={{ marginTop: 4, paddingTop: 4, borderTop: '1px solid #e2e8f0' }}>
                              {warehouseStock.get(p.id)!.map((ws) => (
                                <div key={ws.warehouse_id} style={{ fontSize: 10, color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
                                  <span>{ws.warehouse_name || ws.warehouse_id}</span>
                                  <span style={{ fontWeight: 600 }}>{ws.available}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
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
                            {'\u672a\u5173\u8054'}
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
        
        {/* 分页控件 */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          padding: '16px 0',
          marginTop: 16
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#64748b' }}>
            <span>每页显示</span>
            <select 
              value={pageSize} 
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              style={{
                padding: '4px 8px',
                border: '1px solid #e2e8f0',
                borderRadius: 4,
                background: '#fff',
                fontSize: 13
              }}
            >
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>条</span>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: '#64748b' }}>
              第 {page} 页 / 共 {Math.ceil(total / pageSize)} 页
            </span>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              style={{ marginLeft: 8 }}
            >
              上一页
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setPage(Math.min(Math.ceil(total / pageSize), page + 1))}
              disabled={page >= Math.ceil(total / pageSize)}
            >
              下一页
            </button>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingId ? '\u7f16\u8f91\u4ea7\u54c1' : '\u65b0\u5efa\u4ea7\u54c1'}</h3>
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
                  placeholder={'\u4f8b\u5982 TK-EL-001'}
                />
              </div>
              <div className="form-group">
                <label>{'\u4ea7\u54c1\u540d\u79f0 *'}</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder={'\u4ea7\u54c1\u540d\u79f0'}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label>{'\u6210\u672c\u4ef7 (ZAR)'}</label>
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
                  <label>{'\u552e\u4ef7 (ZAR)'}</label>
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
                <label>{'\u56fe\u7247 URL'}</label>
                <input
                  value={form.image_url}
                  onChange={(e) =>
                    setForm({ ...form, image_url: e.target.value })
                  }
                  placeholder="https://..."
                />
              </div>
              <div className="form-group">
                <label>Takealot {'\u4ea7\u54c1 ID'}</label>
                <input
                  value={form.takealot_product_id}
                  onChange={(e) =>
                    setForm({ ...form, takealot_product_id: e.target.value })
                  }
                  placeholder={'\u4f8b\u5982 TL-10234'}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowModal(false)}
              >
                {'\u53d6\u6d88'}
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? '\u4fdd\u5b58\u4e2d...' : editingId ? '\u66f4\u65b0' : '\u521b\u5efa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
