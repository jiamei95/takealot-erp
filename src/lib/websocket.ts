// WebSocket 服务器
// 用于实时推送新订单、库存变化等数据

import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';

let wss: WebSocketServer | null = null;
const clients = new Set<WebSocket>();

export function initWebSocket(server: Server) {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    console.log('[WebSocket] Client connected');
    clients.add(ws);

    ws.on('close', () => {
      console.log('[WebSocket] Client disconnected');
      clients.delete(ws);
    });

    ws.on('error', (err) => {
      console.error('[WebSocket] Error:', err);
      clients.delete(ws);
    });
  });

  console.log('[WebSocket] Server initialized on /ws');
}

// 广播消息给所有客户端
export function broadcast(message: object) {
  const data = JSON.stringify(message);
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

// 通知客户端有新数据
export function notifyDataUpdate(type: string, count?: number) {
  broadcast({
    type: 'data_update',
    dataType: type,
    count,
    timestamp: new Date().toISOString(),
  });
}
