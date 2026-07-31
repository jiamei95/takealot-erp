'use client';

import { useEffect, useState, useCallback } from 'react';
import { KeyRound, Plus, Trash2, RefreshCw, Link2, Unlink, X, CheckCircle, AlertCircle } from 'lucide-react';

interface StoreAuth {
  id: number;
  store_name: string;
  api_key: string;
  api_base_url: string;
  api_secret: string;
  access_token: string;
  token_expires_at: string;
  auth_status: string;
  last_sync_at: string;
  created_at: string;
  updated_at: string;
}

const emptyForm = {
  store_name: '',
  api_key: '',
  api_base_url: '',
};

export default function StoreAuthPage() {
  const [stores, setStores] = useState<StoreAuth[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [syncResult, setSyncResult] = useState<{ store_id: number; message: string; success: boolean } | null>(null);

  const fetchStores = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/store-auth');
      const text = await res.text();
      console.log('[StoreAuth] Response:', text.substring(0, 200));
      let json;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        console.error('Invalid JSON response:', text);
        return;
      }
      if (json?.store_auth) {
        console.log('[StoreAuth] Found stores:', json.store_auth.length);
        setStores(json.store_auth);
      } else {
        console.log('[StoreAuth] No store_auth in response');
        setStores([]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Failed to fetch store auth:', err);
      setError(`加载店铺列表失败: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStores();
  }, [fetchStores]);

  const openCreate = () => {
    setForm(emptyForm);
    setEditingId(null);
    setError('');
    setShowModal(true);
  };

  const openEdit = (s: StoreAuth) => {
    setForm({
      store_name: s.store_name,
      api_key: s.api_key,
      api_base_url: s.api_base_url || '',
    });
    setEditingId(s.id);
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.store_name) {
      setError('店铺名称为必填项');
      return;
    }
    if (!form.api_key) {
      setError('请填写 API Key');
      return;
    }
    setSaving(true);
    setError('');
    try {
      console.log('[StoreAuth] Sending POST request:', { store_name: form.store_name, api_key: form.api_key.substring(0, 10) + '...' });
      
      const res = await fetch('/api/store-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      
      console.log('[StoreAuth] Response status:', res.status, 'headers:', Object.fromEntries(res.headers.entries()));
      
      // Check if response has content before parsing
      const text = await res.text();
      console.log('[StoreAuth] Response text length:', text.length, 'preview:', text.substring(0, 200));
      
      let json;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        throw new Error(`服务器返回了无效响应 (HTTP ${res.status}): ${text.substring(0, 100)}`);
      }
      
      if (!res.ok) {
        setError(json?.error || `保存失败 (HTTP ${res.status})`);
        return;
      }
      
      if (!json) {
        throw new Error('服务器返回了空响应');
      }
      
      console.log('[StoreAuth] Save successful:', json);
      setShowModal(false);
      
      // 刷新列表
      await fetchStores();
      
      // 显示成功提示
      alert('授权保存成功！系统已开始自动同步（每60秒一次）');
      
      // 保存成功后自动触发同步
      try {
        await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'sync' }),
        });
      } catch (syncErr) {
        console.error('Auto sync failed:', syncErr);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`请求失败: ${msg}`);
      console.error('[StoreAuth] Save error:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('\u786e\u5b9a\u8981\u5220\u9664\u8be5\u5e97\u94fa\u6388\u6743\u5417\uff1f\u5220\u9664\u540e\u5c06\u65e0\u6cd5\u540c\u6b65\u6570\u636e\u3002')) return;
    try {
      await fetch(`/api/store-auth?id=${id}`, { method: 'DELETE' });
      fetchStores();
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  };

  const handleDisconnect = async (id: number) => {
    try {
      await fetch('/api/store-auth', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, auth_status: 'disconnected' }),
      });
      fetchStores();
    } catch (err) {
      console.error('Failed to disconnect:', err);
    }
  };

  const handleSync = async (id: number) => {
    setSyncingId(id);
    setSyncResult(null);
    try {
      const res = await fetch('/api/store-auth/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_id: id }),
      });
      const json = await res.json();
      if (res.ok) {
        const hasData = (json.synced_data?.products_synced || 0) > 0 || (json.synced_data?.orders_synced || 0) > 0;
        let msg = json.message;
        if (json.errors?.length) msg += `\n\n详细错误：\n${json.errors.join('\n')}`;
        if (json.debug?.length) {
          msg += `\n\n--- API 调试信息 ---\n`;
          msg += json.debug.map((d: { url: string; status: number; body: string }) =>
            `[${d.status}] ${d.url}\n响应: ${d.body.slice(0, 200)}`
          ).join('\n\n');
        }
        setSyncResult({ store_id: id, message: msg, success: hasData });
        fetchStores();
      } else {
        setSyncResult({ store_id: id, message: json.error || '同步失败', success: false });
      }
    } catch {
      setSyncResult({ store_id: id, message: '网络错误', success: false });
    } finally {
      setSyncingId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('zh-CN');
  };

  return (
    <div>
      <div className="page-header">
        <h2>{'\u5e97\u94fa\u6388\u6743'}</h2>
        <p>{'\u7ed1\u5b9a Takealot \u5b98\u65b9 API\uff0c\u5b9e\u73b0\u6570\u636e\u81ea\u52a8\u540c\u6b65'}</p>
      </div>

      {/* API Guide */}
      <div className="card" style={{ marginBottom: 24, borderLeft: '3px solid #3b82f6' }}>
        <div style={{ padding: '16px 20px' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#1e40af' }}>
            Takealot Marketplace API 授权指南
          </h3>
          <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.8 }}>
            <p>要连接 Takealot 官方 API，您需要：</p>
            <ol style={{ paddingLeft: 20, margin: '8px 0' }}>
              <li>登录 Takealot Seller Portal (seller.takealot.com)</li>
              <li>进入 "设置 → API 管理" 页面</li>
              <li>复制您的 API Key</li>
              <li>将 API Key 填写到下方表单中完成授权</li>
            </ol>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 8 }}>
              <p>API 基础地址：<code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>https://marketplace-api.takealot.com/v1</code></p>
              <p>同步接口：/offers（产品）、/sales（订单）、/transactions（交易明细）</p>
            </div>
            <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 8 }}>
              授权后点击"同步数据"即可从 Takealot 拉取产品、订单和交易数据。
            </p>
          </div>
        </div>
      </div>

      <div className="toolbar">
        <span style={{ fontSize: 13, color: '#16a34a', fontWeight: 600 }}>
          已授权店铺: {stores.length} 个
        </span>
        <div style={{ flex: 1 }} />
        <button className="btn btn-primary" onClick={openCreate}>
          <Plus size={14} />
          添加店铺授权
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
          {'\u52a0\u8f7d\u4e2d...'}
        </div>
      ) : stores.length === 0 ? (
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
          <KeyRound size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
          <p>{'\u5c1a\u672a\u6dfb\u52a0\u4efb\u4f55\u5e97\u94fa\u6388\u6743'}</p>
          <p style={{ fontSize: 12, marginTop: 4 }}>{'\u70b9\u51fb\u201c\u6dfb\u52a0\u5e97\u94fa\u6388\u6743\u201d\u5f00\u59cb\u7ed1\u5b9a Takealot \u5e97\u94fa'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {stores.map((s) => {
            const isConnected = s.auth_status === 'connected';
            return (
              <div className="card" key={s.id}>
                <div className="card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        background: isConnected ? '#dcfce7' : '#f1f5f9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {isConnected ? (
                        <CheckCircle size={18} color="#16a34a" />
                      ) : (
                        <AlertCircle size={18} color="#94a3b8" />
                      )}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>
                        {s.store_name}
                      </div>
                      <div style={{ fontSize: 12, color: isConnected ? '#16a34a' : '#94a3b8' }}>
                        {isConnected ? '\u5df2\u8fde\u63a5' : '\u672a\u8fde\u63a5'}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {isConnected && (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleSync(s.id)}
                        disabled={syncingId === s.id}
                      >
                        <RefreshCw size={12} className={syncingId === s.id ? 'spin' : ''} />
                        {syncingId === s.id ? '\u540c\u6b65\u4e2d...' : '\u540c\u6b65\u6570\u636e'}
                      </button>
                    )}
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => openEdit(s)}
                    >
                      {'\u7f16\u8f91'}
                    </button>
                    {isConnected ? (
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleDisconnect(s.id)}
                        title={'\u65ad\u5f00\u8fde\u63a5'}
                      >
                        <Unlink size={12} />
                      </button>
                    ) : (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => openEdit(s)}
                        title={'\u91cd\u65b0\u8fde\u63a5'}
                      >
                        <Link2 size={12} />
                      </button>
                    )}
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDelete(s.id)}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                <div className="card-body" style={{ padding: '12px 20px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, fontSize: 13 }}>
                    <div>
                      <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 2 }}>API Key</div>
                      <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#334155' }}>
                        {s.api_key ? `${s.api_key.substring(0, 8)}...${s.api_key.substring(s.api_key.length - 4)}` : '-'}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 2 }}>{'\u6700\u540e\u540c\u6b65'}</div>
                      <div style={{ fontSize: 12, color: '#334155' }}>
                        {s.last_sync_at ? formatDate(s.last_sync_at) : '\u672a\u540c\u6b65'}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 2 }}>Token {'\u8fc7\u671f'}</div>
                      <div style={{ fontSize: 12, color: '#334155' }}>
                        {s.token_expires_at ? formatDate(s.token_expires_at) : '-'}
                      </div>
                    </div>
                  </div>

                  {syncResult && syncResult.store_id === s.id && (
                    <div
                      style={{
                        marginTop: 12,
                        padding: '8px 12px',
                        borderRadius: 6,
                        fontSize: 12,
                        background: syncResult.success ? '#f0fdf4' : '#fef2f2',
                        color: syncResult.success ? '#16a34a' : '#dc2626',
                        border: `1px solid ${syncResult.success ? '#bbf7d0' : '#fecaca'}`,
                      }}
                    >
                      {syncResult.message}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingId ? '\u7f16\u8f91\u5e97\u94fa\u6388\u6743' : '\u6dfb\u52a0\u5e97\u94fa\u6388\u6743'}</h3>
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
                <label>{'\u5e97\u94fa\u540d\u79f0 *'}</label>
                <input
                  value={form.store_name}
                  onChange={(e) => setForm({ ...form, store_name: e.target.value })}
                  placeholder={'\u4f8b\u5982 Takealot Main'}
                />
              </div>
              <div className="form-group">
                <label>API Key *</label>
                <input
                  value={form.api_key}
                  onChange={(e) => setForm({ ...form, api_key: e.target.value })}
                  placeholder="从 Takealot Seller Portal 获取 API Key"
                />
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                  登录 Takealot Seller Portal → 设置 → API 管理中获取
                </div>
              </div>
              <div className="form-group">
                <label>API 地址（可选）</label>
                <input
                  value={form.api_base_url}
                  onChange={(e) => setForm({ ...form, api_base_url: e.target.value })}
                  placeholder="https://marketplace-api.takealot.com/v1"
                />
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                  默认 https://marketplace-api.takealot.com/v1，如 Takealot 提供其他地址请修改
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                {'\u53d6\u6d88'}
              </button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? '\u4fdd\u5b58\u4e2d...' : editingId ? '\u66f4\u65b0' : '\u6388\u6743\u5e76\u4fdd\u5b58'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
