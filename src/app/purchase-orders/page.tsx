'use client';

import { useEffect, useState } from 'react';
import {
  FileText,
  Plus,
  Package,
  Truck,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Filter,
  Trash2,
  X,
  ShoppingCart,
} from 'lucide-react';

interface PO {
  id: number;
  po_number: string;
  destination_warehouse: string;
  total_items: number;
  total_quantity: number;
  status: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

interface Product {
  id: number;
  sku: string;
  name: string;
  cost_price: number;
  image_url: string;
}

interface POItem {
  id: number;
  po_id: number;
  product_id: number;
  sku: string;
  product_name: string;
  quantity: number;
  cost_price: number;
  subtotal: number;
}

const statusMap: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: '待发货', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: Clock },
  shipped: { label: '已发货', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Truck },
  delivered: { label: '已送达', color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle },
  cancelled: { label: '已取消', color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle },
};

const WAREHOUSES = [
  { id: 'JHB', name: '约翰内斯堡 (JHB)', address: 'Gauteng, Johannesburg' },
  { id: 'CPT', name: '开普敦 (CPT)', address: 'Western Cape, Cape Town' },
  { id: 'DUR', name: '德班 (DUR)', address: 'KwaZulu-Natal, Durban' },
  { id: 'PLZ', name: '伊丽莎白港 (PLZ)', address: 'Eastern Cape, Port Elizabeth' },
  { id: 'BFN', name: '布隆方丹 (BFN)', address: 'Free State, Bloemfontein' },
];

export default function PurchaseOrdersPage() {
  const [pos, setPos] = useState<PO[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetail, setShowDetail] = useState<PO | null>(null);
  const [detailItems, setDetailItems] = useState<POItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [form, setForm] = useState({ notes: '', warehouse: 'JHB' });
  const [items, setItems] = useState<{ product_id: number; quantity: number }[]>([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [quantity, setQuantity] = useState('1');

  const fetchPOs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/purchase-orders?${params}`);
      const json = await res.json();
      setPos(json.purchase_orders || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products');
      const json = await res.json();
      setProducts(json.products || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchPOs();
    fetchProducts();
  }, [search, statusFilter]);

  const handleCreate = async () => {
    if (items.length === 0) {
      setError('至少需要添加一个产品');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          warehouse: form.warehouse,
          notes: form.notes,
          items,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || '创建失败');
        return;
      }
      setShowModal(false);
      setForm({ notes: '', warehouse: 'JHB' });
      setItems([]);
      fetchPOs();
    } catch (e) {
      setError('网络错误');
    } finally {
      setSaving(false);
    }
  };

  const addItem = () => {
    if (!selectedProduct) {
      setError('请选择产品');
      return;
    }
    const qty = parseInt(quantity);
    if (qty < 1) {
      setError('数量至少为 1');
      return;
    }
    const existing = items.find((i) => i.product_id === parseInt(selectedProduct));
    if (existing) {
      setItems(items.map((i) => (i.product_id === parseInt(selectedProduct) ? { ...i, quantity: i.quantity + qty } : i)));
    } else {
      setItems([...items, { product_id: parseInt(selectedProduct), quantity: qty }]);
    }
    setSelectedProduct('');
    setQuantity('1');
    setError('');
  };

  const removeItem = (productId: number) => {
    setItems(items.filter((i) => i.product_id !== productId));
  };

  const handleStatusUpdate = async (id: number, status: string) => {
    try {
      const res = await fetch(`/api/purchase-orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) fetchPOs();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这个 PO 单吗？')) return;
    try {
      const res = await fetch(`/api/purchase-orders/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchPOs();
        if (showDetail?.id === id) setShowDetail(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const viewDetail = async (po: PO) => {
    setShowDetail(po);
    try {
      const res = await fetch(`/api/purchase-orders/${po.id}`);
      const json = await res.json();
      setDetailItems(json.items || []);
    } catch (e) {
      console.error(e);
    }
  };

  const getProductInfo = (productId: number) => {
    return products.find((p) => p.id === productId);
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-[#64748b] mb-1">
          <span>首页</span>
          <span>/</span>
          <span className="text-[#0f172a]">PO 建单</span>
        </div>
        <h1 className="text-xl font-semibold text-[#0f172a]">PO 建单</h1>
        <p className="text-sm text-[#64748b] mt-1">创建和管理采购订单（货件），跟踪发货状态</p>
      </div>

      {/* Actions */}
      <div className="bg-white rounded-lg border border-[#e2e8f0] p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
            <input
              type="text"
              placeholder="搜索 PO 编号..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0070f3]/20 focus:border-[#0070f3]"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#94a3b8]" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0070f3]/20 focus:border-[#0070f3]"
            >
              <option value="">全部状态</option>
              <option value="pending">待发货</option>
              <option value="shipped">已发货</option>
              <option value="delivered">已送达</option>
              <option value="cancelled">已取消</option>
            </select>
          </div>
          <button
            onClick={() => {
              setShowModal(true);
              setError('');
              setForm({ notes: '', warehouse: 'JHB' });
              setItems([]);
              setSelectedProduct('');
              setQuantity('1');
            }}
            className="px-4 py-2 bg-[#0070f3] text-white rounded-lg text-sm font-medium hover:bg-[#0060df] transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            创建 PO 单
          </button>
        </div>
      </div>

      {/* PO List */}
      <div className="bg-white rounded-lg border border-[#e2e8f0]">
        <div className="px-6 py-4 border-b border-[#e2e8f0]">
          <h2 className="font-medium text-[#0f172a]">采购订单列表</h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-[#0070f3] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : pos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-[#94a3b8]">
            <FileText className="w-12 h-12 mb-3" />
            <p className="text-sm">暂无采购订单</p>
            <p className="text-xs mt-1">点击"创建 PO 单"开始</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#e2e8f0] text-xs text-[#64748b] uppercase">
                  <th className="px-6 py-3 text-left font-medium">PO 编号</th>
                  <th className="px-6 py-3 text-left font-medium">目的地仓库</th>
                  <th className="px-6 py-3 text-left font-medium">产品数</th>
                  <th className="px-6 py-3 text-left font-medium">总数量</th>
                  <th className="px-6 py-3 text-left font-medium">状态</th>
                  <th className="px-6 py-3 text-left font-medium">创建时间</th>
                  <th className="px-6 py-3 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {pos.map((po) => {
                  const st = statusMap[po.status] || statusMap.pending;
                  const StatusIcon = st.icon;
                  return (
                    <tr key={po.id} className="border-b border-[#e2e8f0] last:border-0 hover:bg-[#f8fafc]">
                      <td className="px-6 py-4">
                        <button onClick={() => viewDetail(po)} className="text-[#0070f3] hover:underline font-mono text-sm">
                          {po.po_number}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-sm text-[#0f172a]">{po.destination_warehouse}</td>
                      <td className="px-6 py-4 text-sm text-[#0f172a]">{po.total_items}</td>
                      <td className="px-6 py-4 text-sm text-[#0f172a]">{po.total_quantity}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${st.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {st.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-[#64748b]">{po.created_at}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {po.status === 'pending' && (
                            <button
                              onClick={() => handleStatusUpdate(po.id, 'shipped')}
                              className="px-2.5 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors"
                            >
                              标记发货
                            </button>
                          )}
                          {po.status === 'shipped' && (
                            <button
                              onClick={() => handleStatusUpdate(po.id, 'delivered')}
                              className="px-2.5 py-1 text-xs bg-green-50 text-green-600 rounded hover:bg-green-100 transition-colors"
                            >
                              标记送达
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(po.id)}
                            className="p-1.5 text-[#94a3b8] hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#e2e8f0]">
              <h3 className="text-lg font-semibold text-[#0f172a]">创建 PO 单</h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-[#f1f5f9] rounded-lg transition-colors">
                <X className="w-5 h-5 text-[#64748b]" />
              </button>
            </div>
            <div className="p-6">
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>
              )}

              {/* 选择目的地仓库 */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-[#0f172a] mb-2">
                  目的地仓库 <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.warehouse}
                  onChange={(e) => setForm({ ...form, warehouse: e.target.value })}
                  className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0070f3]/20 focus:border-[#0070f3]"
                >
                  {WAREHOUSES.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} - {w.address}
                    </option>
                  ))}
                </select>
              </div>

              {/* 添加产品 */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-[#0f172a] mb-2">添加产品</label>
                <div className="flex gap-2">
                  <select
                    value={selectedProduct}
                    onChange={(e) => setSelectedProduct(e.target.value)}
                    className="flex-1 px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0070f3]/20 focus:border-[#0070f3]"
                  >
                    <option value="">选择产品...</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.sku} - {p.name} (R {p.cost_price.toFixed(2)})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-24 px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0070f3]/20 focus:border-[#0070f3]"
                    placeholder="数量"
                  />
                  <button
                    onClick={addItem}
                    className="px-4 py-2 bg-[#0070f3] text-white rounded-lg text-sm hover:bg-[#0060df] transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    添加
                  </button>
                </div>
              </div>

              {/* 产品清单 */}
              {items.length > 0 && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-[#0f172a] mb-2">
                    产品清单 ({items.length} 个产品)
                  </label>
                  <div className="border border-[#e2e8f0] rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-[#f8fafc] text-xs text-[#64748b]">
                          <th className="px-4 py-2 text-left">SKU</th>
                          <th className="px-4 py-2 text-left">产品</th>
                          <th className="px-4 py-2 text-center">数量</th>
                          <th className="px-4 py-2 text-right">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item) => {
                          const product = getProductInfo(item.product_id);
                          return (
                            <tr key={item.product_id} className="border-t border-[#e2e8f0]">
                              <td className="px-4 py-2 text-sm font-mono">{product?.sku || '-'}</td>
                              <td className="px-4 py-2 text-sm">{product?.name || '-'}</td>
                              <td className="px-4 py-2 text-sm text-center">{item.quantity}</td>
                              <td className="px-4 py-2 text-right">
                                <button
                                  onClick={() => removeItem(item.product_id)}
                                  className="p-1 text-[#94a3b8] hover:text-red-500 transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 备注 */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-[#0f172a] mb-2">备注（可选）</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0070f3]/20 focus:border-[#0070f3]"
                  placeholder="添加备注信息..."
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#e2e8f0]">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-[#64748b] hover:bg-[#f1f5f9] rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={saving || items.length === 0}
                className="px-4 py-2 bg-[#0070f3] text-white rounded-lg text-sm font-medium hover:bg-[#0060df] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    创建中...
                  </>
                ) : (
                  <>
                    <ShoppingCart className="w-4 h-4" />
                    创建 PO 单
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#e2e8f0]">
              <h3 className="text-lg font-semibold text-[#0f172a]">PO 详情 - {showDetail.po_number}</h3>
              <button onClick={() => setShowDetail(null)} className="p-1 hover:bg-[#f1f5f9] rounded-lg transition-colors">
                <X className="w-5 h-5 text-[#64748b]" />
              </button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <div className="text-xs text-[#64748b] mb-1">目的地仓库</div>
                  <div className="text-sm font-medium text-[#0f172a]">{showDetail.destination_warehouse}</div>
                </div>
                <div>
                  <div className="text-xs text-[#64748b] mb-1">状态</div>
                  <div className="text-sm font-medium text-[#0f172a]">
                    {statusMap[showDetail.status]?.label || showDetail.status}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[#64748b] mb-1">产品数</div>
                  <div className="text-sm font-medium text-[#0f172a]">{showDetail.total_items}</div>
                </div>
                <div>
                  <div className="text-xs text-[#64748b] mb-1">总数量</div>
                  <div className="text-sm font-medium text-[#0f172a]">{showDetail.total_quantity}</div>
                </div>
                <div>
                  <div className="text-xs text-[#64748b] mb-1">创建时间</div>
                  <div className="text-sm font-medium text-[#0f172a]">{showDetail.created_at}</div>
                </div>
                <div>
                  <div className="text-xs text-[#64748b] mb-1">更新时间</div>
                  <div className="text-sm font-medium text-[#0f172a]">{showDetail.updated_at}</div>
                </div>
              </div>
              {showDetail.notes && (
                <div className="mb-6">
                  <div className="text-xs text-[#64748b] mb-1">备注</div>
                  <div className="text-sm text-[#0f172a] p-3 bg-[#f8fafc] rounded-lg">{showDetail.notes}</div>
                </div>
              )}
              <div>
                <div className="text-sm font-medium text-[#0f172a] mb-3">产品明细</div>
                <div className="border border-[#e2e8f0] rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-[#f8fafc] text-xs text-[#64748b]">
                        <th className="px-4 py-2 text-left">SKU</th>
                        <th className="px-4 py-2 text-left">产品</th>
                        <th className="px-4 py-2 text-center">数量</th>
                        <th className="px-4 py-2 text-right">单价</th>
                        <th className="px-4 py-2 text-right">小计</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailItems.map((item) => (
                        <tr key={item.id} className="border-t border-[#e2e8f0]">
                          <td className="px-4 py-2 text-sm font-mono">{item.sku}</td>
                          <td className="px-4 py-2 text-sm">{item.product_name}</td>
                          <td className="px-4 py-2 text-sm text-center">{item.quantity}</td>
                          <td className="px-4 py-2 text-sm text-right">R {item.cost_price.toFixed(2)}</td>
                          <td className="px-4 py-2 text-sm text-right font-medium">R {item.subtotal.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end px-6 py-4 border-t border-[#e2e8f0]">
              <button
                onClick={() => setShowDetail(null)}
                className="px-4 py-2 text-sm text-[#64748b] hover:bg-[#f1f5f9] rounded-lg transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
