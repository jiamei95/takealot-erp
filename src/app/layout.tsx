import type { Metadata } from 'next';
import './globals.css';
import Sidebar from '@/components/sidebar';
import { SyncStatusBadge } from '@/components/sync-status';

export const metadata: Metadata = {
  title: 'Takealot ERP \u7ba1\u7406\u7cfb\u7edf',
  description: '\u5357\u975e Takealot \u7535\u5546\u5e73\u53f0 ERP \u7ba1\u7406\u7cfb\u7edf',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        <div style={{ display: 'flex', minHeight: '100vh' }}>
          <Sidebar />
          <main className="main-content" style={{ flex: 1 }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', background: '#fff' }}>
              <SyncStatusBadge />
            </div>
            <div style={{ padding: 24 }}>
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
