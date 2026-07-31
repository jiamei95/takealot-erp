// WebSocket 连接状态组件

'use client';

import { useWebSocket } from '@/hooks/useWebSocket';
import { Wifi, WifiOff } from 'lucide-react';

interface WebSocketStatusProps {
  onDataUpdate?: (data: { type: string; dataType: string; count?: number; timestamp: string }) => void;
}

export function WebSocketStatus({ onDataUpdate }: WebSocketStatusProps) {
  const { isConnected } = useWebSocket({ onDataUpdate });

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 12,
        fontSize: 12,
        backgroundColor: isConnected ? '#dcfce7' : '#fee2e2',
        color: isConnected ? '#16a34a' : '#dc2626',
      }}
      title={isConnected ? 'WebSocket 已连接' : 'WebSocket 未连接'}
    >
      {isConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
      <span>{isConnected ? '实时' : '离线'}</span>
    </div>
  );
}
