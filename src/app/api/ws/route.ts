// WebSocket API 路由
// Next.js App Router 不直接支持 WebSocket，需要在 server.ts 中处理
// 这个文件仅用于类型定义

export const dynamic = 'force-dynamic';

export async function GET() {
  return new Response('WebSocket endpoint is handled by the server', {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
    },
  });
}
