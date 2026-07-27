# Takealot ERP System - AGENTS.md

## 项目概览
南非 Takealot 电商平台 ERP 管理系统，提供利润分析、历史分析、订单管理、产品管理、PO 建单五大模块。

## 技术栈
- **Framework**: Next.js 16 (App Router)
- **Core**: React 19, TypeScript 5
- **UI**: shadcn/ui + Tailwind CSS 4
- **Database**: SQLite (better-sqlite3)
- **Charts**: Recharts
- **Icons**: Lucide React

## 目录结构
```
src/
├── app/
│   ├── api/
│   │   ├── products/       # 产品 CRUD API
│   │   ├── orders/         # 订单查询 API
│   │   ├── purchase-orders/ # PO 管理 API
│   │   ├── profit/         # 利润分析 API
│   │   ├── history/        # 历史分析 API
│   │   ├── stores/         # 店铺列表 API
│   │   └── seed/           # 数据种子 API
│   ├── dashboard/          # 利润分析页面
│   ├── history/            # 历史分析页面
│   ├── orders/             # 订单管理页面
│   ├── products/           # 产品管理页面
│   ├── purchase-orders/    # PO 管理页面
│   └── layout.tsx          # 根布局（含侧边栏）
├── components/
│   └── sidebar.tsx         # 导航侧边栏
└── lib/
    ├── db.ts               # SQLite 数据库连接与 Schema
    ├── seed.ts             # Mock 数据种子脚本
    └── utils.ts            # 工具函数
data/
└── erp.db                  # SQLite 数据库文件
```

## 构建与运行
```bash
pnpm install          # 安装依赖
npx tsx src/lib/seed.ts  # 初始化数据库（首次运行）
pnpm run dev          # 开发环境
pnpm run build        # 生产构建
pnpm run start        # 生产运行
```

## 数据库说明
- 数据库文件位于 `data/erp.db`
- 使用 better-sqlite3 同步 API
- 表：stores, products, orders, purchase_orders, purchase_order_items
- 货币单位：ZAR（南非兰特）

## API 接口清单
| 路径 | 方法 | 说明 |
|------|------|------|
| /api/profit | GET | 利润分析（支持 store 筛选） |
| /api/history | GET | 历史趋势（支持 start/end/dimension/store） |
| /api/orders | GET | 订单列表（支持 search/status/store/page） |
| /api/products | GET/POST | 产品列表/创建 |
| /api/products/[id] | PUT/DELETE | 产品编辑/删除 |
| /api/purchase-orders | GET/POST | PO 列表/创建 |
| /api/purchase-orders/[id] | PUT/DELETE | PO 状态更新/删除 |
| /api/stores | GET | 店铺列表 |
| /api/seed | POST | 重新填充 Mock 数据 |

## 编码规范
- 所有 API 路由使用 `export const dynamic = 'force-dynamic'`
- 数据库操作使用 better-sqlite3 同步 API
- 前端使用 'use client' 指令
- 金额格式化使用 `formatZAR()` 函数（R xxx.xx）
