'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, CheckCircle, AlertCircle, Clock } from 'lucide-react';

interface SyncStatus {
  lastSyncTime: string | null;
  isSyncing: boolean;
  productsCount: number;
  ordersCount: number;
  error: string | null;
  dbStats?: {
    products: number;
    orders: number;
  };
  apiKeyConfigured: boolean;
  storeName: string | null;
  syncEnabled: boolean;
  totalSyncs: number;
}

export function SyncStatusBadge() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/sync');
      const json = await res.json();
      if (json.success) {
        setStatus(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch sync status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // 每 30 秒刷新状态
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleManualSync = async () => {
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync' }),
      });
      const json = await res.json();
      if (json.success) {
        fetchStatus();
      } else {
        alert(json.message || '同步失败');
      }
    } catch {
      alert('网络错误');
    }
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 8, 
        padding: '8px 12px',
        background: '#f8fafc',
        borderRadius: 8,
        fontSize: 12,
        color: '#64748b',
      }}>
        <RefreshCw size={14} className="animate-spin" />
        加载中...
      </div>
    );
  }

  if (!status) {
    return null;
  }

  const isHealthy = status.apiKeyConfigured && !status.error;
  const lastSync = status.lastSyncTime 
    ? new Date(status.lastSyncTime).toLocaleString('zh-CN')
    : '从未同步';

  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: 12,
      padding: '10px 16px',
      background: isHealthy ? '#f0fdf4' : status.error ? '#fef2f2' : '#fefce8',
      borderRadius: 8,
      border: `1px solid ${isHealthy ? '#bbf7d0' : status.error ? '#fecaca' : '#fef08a'}`,
      fontSize: 13,
    }}>
      {status.isSyncing ? (
        <RefreshCw size={16} className="animate-spin" style={{ color: '#3b82f6' }} />
      ) : isHealthy ? (
        <CheckCircle size={16} style={{ color: '#16a34a' }} />
      ) : status.error ? (
        <AlertCircle size={16} style={{ color: '#dc2626' }} />
      ) : (
        <Clock size={16} style={{ color: '#ca8a04' }} />
      )}
      
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, color: isHealthy ? '#166534' : status.error ? '#991b1b' : '#854d0e' }}>
          {status.isSyncing ? '同步中...' : isHealthy ? '永久授权 · 自动同步中' : status.error ? '同步异常' : '等待授权'}
        </div>
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
          上次同步: {lastSync} | 产品: {status.dbStats?.products || 0} | 订单: {status.dbStats?.orders || 0} | 同步次数: {status.totalSyncs || 0}
        </div>
        {status.error && (
          <div style={{ fontSize: 11, color: '#dc2626', marginTop: 2 }}>
            错误: {status.error}
          </div>
        )}
        {isHealthy && (
          <div style={{ fontSize: 10, color: '#16a34a', marginTop: 2 }}>
            每60秒自动同步 · 授权永久有效
          </div>
        )}
      </div>
      
      <button
        onClick={handleManualSync}
        disabled={status.isSyncing}
        style={{
          padding: '6px 12px',
          background: status.isSyncing ? '#e2e8f0' : '#3b82f6',
          color: status.isSyncing ? '#94a3b8' : '#fff',
          border: 'none',
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 500,
          cursor: status.isSyncing ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <RefreshCw size={12} className={status.isSyncing ? 'animate-spin' : ''} />
        {status.isSyncing ? '同步中' : '手动同步'}
      </button>
    </div>
  );
}
