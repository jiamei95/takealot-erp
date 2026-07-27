import type { Metadata } from 'next';
import './globals.css';
import Sidebar from '@/components/sidebar';

export const metadata: Metadata = {
  title: 'Takealot ERP System',
  description: 'South African Takealot E-commerce ERP Management System',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div style={{ display: 'flex', minHeight: '100vh' }}>
          <Sidebar />
          <main className="main-content" style={{ flex: 1 }}>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
