'use client';

import { useState, useEffect } from 'react';
import { Package, Plus, Upload, Download, Search, Filter, FileText, CheckCircle, Clock, XCircle, Truck } from 'lucide-react';

interface PO {
  id: number;
  po_number: string;
  store_name: string;
  destination_warehouse: string;
  status: string;
  total_items: number;
  total_quantity: number;
  platform_shipment_id: string;
  created_at: string;
  updated_at: string;
}

interface Product {
  id: number;
  sku: string;
  title: string;
  cost_price: number;
}

interface Store {
  id: number;
  name: string;
}

const WAREHOUSES = [
  { code: 'JNB', name: '约翰内斯堡仓', color: 'bg-blue-100 text-blue-800' },
  { code: 'CPT', name: '开普敦仓', color: 'bg-green-100 text-green-800' },
  { code: 'DBN', name: '德班仓', color: 'bg-purple-100 text-purple-800' },
  { code: 'PLZ', name: '伊丽莎白港仓', color: 'bg-orange-100 text-orange-800' },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: '草稿', color: 'bg-gray-100 text-gray-700', icon: FileText },
  created: { label: '已创建', color: 'bg-blue-100 text-blue-700', icon: CheckCircle },
  dispatched: { label: '已发货', color: 'bg-purple-100 text-purple-700', icon: Truck },
  delivered: { label: '已送达', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  cancelled: { label: '已取消', color: 'bg-red-100 text-red-700', icon: XCircle },
};

export default function PurchaseOrdersPage() {
  const [pos, setPos] = useState<PO[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [warehouseFilter, setWarehouseFilter] = useState('all');

  // 统计
  const [stats, setStats] = useState({
    total: 0,
    draft: 0,
    created: 0,
    dispatched: 0,
    delivered: 0,
    cancelled: 0,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [poRes, productRes, storeRes] = await Promise.all([
        fetch('/api/purchase-orders'),
        fetch('/api/products'),
        fetch('/api/stores'),
      ]);
      const poData = await poRes.json();
      const productData = await productRes.json();
      const storeData = await storeRes.json();

      setPos(poData.purchase_orders || []);
      setProducts(productData.products || []);
      setStores(storeData.stores || []);

      // 计算统计
      const posList = poData.purchase_orders || [];
      setStats({
        total: posList.length,
        draft: posList.filter((p: PO) => p.status === 'draft').length,
        created: posList.filter((p: PO) => p.status === 'created').length,
        dispatched: posList.filter((p: PO) => p.status === 'dispatched').length,
        delivered: posList.filter((p: PO) => p.status === 'delivered').length,
        cancelled: posList.filter((p: PO) => p.status === 'cancelled').length,
      });
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
    const Icon = config.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </span>
    );
  };

  const getWarehouseBadge = (warehouse: string) => {
    const wh = WAREHOUSES.find(w => w.code === warehouse);
    if (!wh) return <span className="text-gray-500">{warehouse}</span>;
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${wh.color}`}>
        {wh.code}
      </span>
    );
  };

  const filteredPOs = pos.filter(po => {
    const matchSearch = po.po_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
                       po.platform_shipment_id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = statusFilter === 'all' || po.status === statusFilter;
    const matchWarehouse = warehouseFilter === 'all' || po.destination_warehouse === warehouseFilter;
    return matchSearch && matchStatus && matchWarehouse;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">发货单管理</h1>
          <p className="text-sm text-gray-500 mt-1">运营 / 发货单管理 (领星备货中转出库)</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          新建发货单
        </button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">发货单总数</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">草稿</p>
          <p className="text-2xl font-bold text-gray-600 mt-1">{stats.draft}</p>
          <p className="text-xs text-gray-400 mt-1">未发货·未取消</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">已创建</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{stats.created}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">已发货</p>
          <p className="text-2xl font-bold text-purple-600 mt-1">{stats.dispatched}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">已送达</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{stats.delivered}</p>
        </div>
      </div>

      {/* 筛选栏 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜 PO 号 / shipment_id"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">全部状态</option>
            <option value="draft">草稿</option>
            <option value="created">已创建</option>
            <option value="dispatched">已发货</option>
            <option value="delivered">已送达</option>
            <option value="cancelled">已取消</option>
          </select>
          <select
            value={warehouseFilter}
            onChange={(e) => setWarehouseFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">全部仓库</option>
            {WAREHOUSES.map(wh => (
              <option key={wh.code} value={wh.code}>{wh.name}</option>
            ))}
          </select>
          <button
            onClick={fetchData}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
          >
            刷新
          </button>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors">
            导出
          </button>
        </div>
      </div>

      {/* PO 列表 */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="text-sm font-medium text-gray-900">发货单列表</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">时间</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">PO 编号</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">店铺</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">目的仓</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">总量</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">shipment_id</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredPOs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                    <Package className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                    <p>暂无发货单</p>
                    <p className="text-xs text-gray-400 mt-1">点击"新建发货单"开始创建</p>
                  </td>
                </tr>
              ) : (
                filteredPOs.map(po => (
                  <tr key={po.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(po.created_at).toLocaleDateString('zh-CN')}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-gray-900">{po.po_number}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{po.store_name}</td>
                    <td className="px-4 py-3">{getWarehouseBadge(po.destination_warehouse)}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 font-medium">{po.total_quantity}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {po.platform_shipment_id || '-'}
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(po.status)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button className="text-xs text-blue-600 hover:text-blue-800">
                          查看
                        </button>
                        {po.status !== 'draft' && (
                          <button className="text-xs text-purple-600 hover:text-purple-800">
                            下载标签
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 创建 PO 模态框 */}
      {showCreateModal && (
        <CreatePOModal
          products={products}
          stores={stores}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchData();
          }}
        />
      )}
    </div>
  );
}

// 创建 PO 模态框组件
function CreatePOModal({
  products,
  stores,
  onClose,
  onSuccess,
}: {
  products: Product[];
  stores: Store[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [selectedStore, setSelectedStore] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [items, setItems] = useState<Array<{ product_id: number; quantity: number }>>([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [quantity, setQuantity] = useState('');
  const [loading, setLoading] = useState(false);

  const addItem = () => {
    if (!selectedProduct || !quantity) return;
    const existing = items.find(item => item.product_id === parseInt(selectedProduct));
    if (existing) {
      setItems(items.map(item =>
        item.product_id === parseInt(selectedProduct)
          ? { ...item, quantity: item.quantity + parseInt(quantity) }
          : item
      ));
    } else {
      setItems([...items, { product_id: parseInt(selectedProduct), quantity: parseInt(quantity) }]);
    }
    setSelectedProduct('');
    setQuantity('');
  };

  const removeItem = (productId: number) => {
    setItems(items.filter(item => item.product_id !== productId));
  };

  const handleSubmit = async () => {
    if (!selectedStore || !selectedWarehouse || items.length === 0) {
      alert('请选择店铺、仓库并添加产品');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_id: parseInt(selectedStore),
          destination_warehouse: selectedWarehouse,
          items: items,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        onSuccess();
      } else {
        alert(data.error || '创建失败');
      }
    } catch (error) {
      alert('网络错误');
    } finally {
      setLoading(false);
    }
  };

  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">新建发货单</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* 基本信息 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">店铺</label>
              <select
                value={selectedStore}
                onChange={(e) => setSelectedStore(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="">选择店铺</option>
                {stores.map(store => (
                  <option key={store.id} value={store.id}>{store.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">目的仓库</label>
              <select
                value={selectedWarehouse}
                onChange={(e) => setSelectedWarehouse(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="">选择仓库</option>
                {WAREHOUSES.map(wh => (
                  <option key={wh.code} value={wh.code}>{wh.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 添加产品 */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-900 mb-3">添加产品</h3>
            <div className="flex gap-3">
              <select
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="">选择产品</option>
                {products.map(product => (
                  <option key={product.id} value={product.id}>
                    {product.sku} - {product.title} (成本: R{product.cost_price})
                  </option>
                ))}
              </select>
              <input
                type="number"
                placeholder="数量"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={addItem}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
              >
                添加
              </button>
            </div>
          </div>

          {/* 产品清单 */}
          {items.length > 0 && (
            <div className="border border-gray-200 rounded-lg">
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                <h3 className="text-sm font-medium text-gray-900">产品清单 ({items.length} 种，共 {totalQuantity} 件)</h3>
              </div>
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">SKU</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">产品名称</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">数量</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">成本价</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">小计</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {items.map(item => {
                    const product = products.find(p => p.id === item.product_id);
                    if (!product) return null;
                    return (
                      <tr key={item.product_id}>
                        <td className="px-4 py-2 text-sm font-mono text-gray-900">{product.sku}</td>
                        <td className="px-4 py-2 text-sm text-gray-600">{product.title}</td>
                        <td className="px-4 py-2 text-sm text-gray-900 font-medium">{item.quantity}</td>
                        <td className="px-4 py-2 text-sm text-gray-600">R{product.cost_price}</td>
                        <td className="px-4 py-2 text-sm text-gray-900 font-medium">R{(product.cost_price * item.quantity).toFixed(2)}</td>
                        <td className="px-4 py-2">
                          <button
                            onClick={() => removeItem(item.product_id)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            删除
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '创建中...' : '创建发货单'}
          </button>
        </div>
      </div>
    </div>
  );
}
