# Takealot ERP 系统

南非 Takealot 电商平台 ERP 管理系统，提供利润分析、历史分析、订单管理、产品管理、PO 建单、店铺授权六大模块。

## 技术栈

- **Framework**: Next.js 16 (App Router)
- **Core**: React 19, TypeScript 5
- **UI**: shadcn/ui + Tailwind CSS 4
- **Database**: SQLite (better-sqlite3)
- **Charts**: Recharts
- **Icons**: Lucide React

## 本地部署运行

### 环境要求

- Node.js 18+ 
- pnpm（推荐）或 npm

### 安装步骤

```bash
# 1. 安装依赖
pnpm install

# 2. 初始化数据库（创建空表结构）
npx tsx src/lib/seed.ts

# 3. 启动开发服务器
pnpm run dev
```

启动后，在浏览器中打开 [http://localhost:5000](http://localhost:5000) 查看应用。

### 生产环境部署

```bash
# 构建生产版本
pnpm run build

# 启动生产服务器
pnpm run start
```

## 功能模块

### 1. 利润分析 (`/dashboard`)
- 总订单数、总销售额(ZAR)、总利润和利润率
- 平台佣金、支付手续费、仓储费明细
- 按店铺维度筛选

### 2. 历史分析 (`/history`)
- 日期段筛选，日/周/月维度切换
- 折线图/柱状图展示销售与利润趋势

### 3. 订单管理 (`/orders`)
- 订单明细（含佣金/手续费/仓储费/利润）
- 状态筛选、关键字搜索、分页

### 4. 产品管理 (`/products`)
- 产品 CRUD，Takealot 产品 ID 配对

### 5. PO 建单 (`/purchase-orders`)
- 创建采购订单，状态跟踪

### 6. 店铺授权 (`/store-auth`)
- 绑定 Takealot 店铺 API Key
- 一键同步产品和订单数据

## Takealot API 对接

### 认证方式
- Header: `X-API-Key: <your-api-key>`

### API 端点
- Base URL: `https://marketplace-api.takealot.com/v1`
- 产品: `GET /offers`（continuation_token 分页）
- 订单: `GET /sales`（continuation_token 分页）
- 交易: `GET /transactions`

### 使用流程
1. 登录 Takealot Seller Portal
2. 进入设置 → API 管理 → 复制 API Key
3. 在 ERP 系统「店铺授权」页面添加授权
4. 点击「同步数据」拉取真实数据

> **注意**：如果在云服务器上运行，Takealot API 可能被 Cloudflare 拦截（403）。建议在本地电脑运行本系统。

## 数据库

- 数据库文件位于 `data/erp.db`（SQLite）
- 货币单位：ZAR（南非兰特）
- 首次运行需执行 `npx tsx src/lib/seed.ts` 初始化表结构

## 项目结构

```
src/
├── app/
│   ├── api/              # API 路由
│   │   ├── products/     # 产品 CRUD
│   │   ├── orders/       # 订单查询
│   │   ├── purchase-orders/ # PO 管理
│   │   ├── profit/       # 利润分析
│   │   ├── history/      # 历史分析
│   │   ├── stores/       # 店铺列表
│   │   └── store-auth/   # 店铺授权 & 同步
│   ├── dashboard/        # 利润分析页面
│   ├── history/          # 历史分析页面
│   ├── orders/           # 订单管理页面
│   ├── products/         # 产品管理页面
│   ├── purchase-orders/  # PO 管理页面
│   ├── store-auth/       # 店铺授权页面
│   └── layout.tsx        # 根布局
├── components/
│   └── sidebar.tsx       # 导航侧边栏
└── lib/
    ├── db.ts             # SQLite 数据库连接
    └── seed.ts           # 数据库初始化脚本
data/
└── erp.db                # SQLite 数据库文件
```
