'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  BarChart3,
  ShoppingCart,
  Package,
  FileText,
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Profit Analysis', icon: LayoutDashboard },
  { href: '/history', label: 'Historical Analysis', icon: BarChart3 },
  { href: '/orders', label: 'Order Management', icon: ShoppingCart },
  { href: '/products', label: 'Product Management', icon: Package },
  { href: '/purchase-orders', label: 'PO Management', icon: FileText },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div
          style={{
            width: 32,
            height: 32,
            background: '#1e40af',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 800,
            fontSize: 14,
          }}
        >
          T
        </div>
        <div>
          <h1>Takealot ERP</h1>
          <span>v1.0</span>
        </div>
      </div>
      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={isActive ? 'active' : ''}
            >
              <Icon />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div
        style={{
          padding: '16px',
          borderTop: '1px solid #1e293b',
          fontSize: 11,
          color: '#475569',
        }}
      >
        Currency: ZAR (R)
      </div>
    </aside>
  );
}
