'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  BarChart3,
  ShoppingCart,
  Package,
  FileText,
  KeyRound,
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: '\u5229\u6da6\u5206\u6790', icon: LayoutDashboard },
  { href: '/history', label: '\u5386\u53f2\u5206\u6790', icon: BarChart3 },
  { href: '/orders', label: '\u8ba2\u5355\u7ba1\u7406', icon: ShoppingCart },
  { href: '/products', label: '\u4ea7\u54c1\u7ba1\u7406', icon: Package },
  { href: '/purchase-orders', label: 'PO \u5efa\u5355', icon: FileText },
  { href: '/store-auth', label: '\u5e97\u94fa\u6388\u6743', icon: KeyRound },
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
        \u8d27\u5e01: ZAR (R)
      </div>
    </aside>
  );
}
