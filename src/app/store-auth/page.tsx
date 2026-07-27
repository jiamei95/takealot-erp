'use client';

import { useEffect, useState, useCallback } from 'react';
import { KeyRound, Plus, Trash2, RefreshCw, Link2, Unlink, X, CheckCircle, AlertCircle } from 'lucide-react';

interface StoreAuth {
  id: number;
  store_name: string;
  api_key: string;
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
  api_secret: '',
  access_token: '',
  token_expires_at: '',
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
      const json = await res.json();
      setStores(json.store_auth);
    } catch (err) {
      console.error('Failed to fetch store auth:', err);
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
      api_secret: s.api_secret,
      access_token: s.access_token,
      token_expires_at: s.token_expires_at,
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
    const hasKeyAndSecret = form.api_key && form.api_secret;
    const hasToken = form.access_token;
    if (!hasKeyAndSecret && !hasToken) {
      setError('请至少填写 API Key + API Secret 或 Access Token');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/store-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || '\u4fdd\u5b58\u5931\u8d25');
        return;
      }
      setShowModal(false);
      fetchStores();
    } catch {
      setError('\u7f51\u7edc\u9519\u8bef');
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
        setSyncResult({ store_id: id, message: json.message, success: true });
        fetchStores();
      } else {
        setSyncResult({ store_id: id, message: json.error || '\u540c\u6b65\u5931\u8d25', success: false });
      }
    } catch {
      setSyncResult({ store_id: id, message: '\u7f51\u7edc\u9519\u8bef', success: false });
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
            Takealot API {'\u6388\u6743\u6307\u5357'}
          </h3>
          <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.8 }}>
            <p>{'\u8981\u8fde\u63a5 Takealot \u5b98\u65b9 API\uff0c\u60a8\u9700\u8981\uff1a'}</p>
            <ol style={{ paddingLeft: 20, margin: '8px 0' }}>
              <li>{'\u767b\u5f55 Takealot Seller Portal (seller.takealot.com)'}</li>
              <li>{'\u8fdb\u5165 \u201c\u8bbe\u7f6e \u2192 API \u8bbf\u95ee\u201d \u9875\u9762'}</li>
              <li>{'\u751f\u6210 API Key \u548c API Secret'}</li>
              <li>{'\u5c06\u51ed\u636e\u586b\u5199\u5230\u4e0b\u65b9\u8868\u5355\u4e2d\u5b8c\u6210\u6388\u6743'}</li>
            </ol>
            <p style={{ fontSize: 12, color: '#94a3b8' }}>
              {'\u2139 \u6388\u6743\u540e\u7cfb\u7edf\u5c06\u81ea\u52a8\u83b7\u53d6 Access Token\uff0c\u5e76\u5b9a\u671f\u540c\u6b65\u4ea7\u54c1\u3001\u8ba2\u5355\u548c\u5e93\u5b58\u6570\u636e\u3002'}
            </p>
          </div>
        </div>
      </div>

      <div className="toolbar">
        <span style={{ fontSize: 12, color: '#64748b' }}>
          {'\u5df2\u6388\u6743\u5e97\u94fa: '}{stores.length} {'\u4e2a'}
        </span>
        <div style={{ flex: 1 }} />
        <button className="btn btn-primary" onClick={openCreate}>
          <Plus size={14} />
          {'\u6dfb\u52a0\u5e97\u94fa\u6388\u6743'}
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
                <label>API Key <span style={{ color: '#94a3b8', fontWeight: 400, fontSize: 12 }}>（方式一：与 Secret 配合使用）</span></label>
                <input
                  value={form.api_key}
                  onChange={(e) => setForm({ ...form, api_key: e.target.value })}
                  placeholder="从 Takealot Seller Portal 获取"
                />
              </div>
              <div className="form-group">
                <label>API Secret <span style={{ color: '#94a3b8', fontWeight: 400, fontSize: 12 }}>（方式一）</span></label>
                <input
                  type="password"
                  value={form.api_secret}
                  onChange={(e) => setForm({ ...form, api_secret: e.target.value })}
                  placeholder="从 Takealot Seller Portal 获取"
                />
              </div>
              <div style={{ padding: '8px 12px', background: '#f1f5f9', borderRadius: 6, fontSize: 12, color: '#64748b', margin: '4px 0' }}>
                方式一（API Key + Secret）和方式二（Access Token）二选一即可
              </div>
              <div className="form-group">
                <label>Access Token <span style={{ color: '#94a3b8', fontWeight: 400, fontSize: 12 }}>（方式二：直接填写）</span></label>
                <input
                  value={form.access_token}
                  onChange={(e) => setForm({ ...form, access_token: e.target.value })}
                  placeholder="如有现成 Token 可直接填入"
                />
              </div>
              <div className="form-group">
                <label>Token {'\u8fc7\u671f\u65f6\u95f4 (\u53ef\u9009)'}</label>
                <input
                  type="datetime-local"
                  value={form.token_expires_at}
                  onChange={(e) => setForm({ ...form, token_expires_at: e.target.value })}
                />
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
