import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// 生产环境使用 /tmp 目录（可写），开发环境使用项目 data 目录
const DB_PATH = process.env.NODE_ENV === 'production'
  ? '/tmp/erp.db'
  : path.join(process.cwd(), 'data', 'erp.db');

// 使用 globalThis 确保跨模块单例
const globalForDb = globalThis as unknown as {
  _erp_db: Database.Database | undefined;
  _erp_db_ready: boolean;
};

// 初始化标记
globalForDb._erp_db_ready = false;

export function getDb(): Database.Database {
  // 如果已有连接且健康，直接返回
  if (globalForDb._erp_db && globalForDb._erp_db_ready) {
    return globalForDb._erp_db;
  }

  // 确保目录存在
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // 创建新连接
  const db = new Database(DB_PATH, {
    fileMustExist: false,
    readonly: false,
  });

  // 配置优化
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 10000');
  db.pragma('cache_size = -64000'); // 64MB 缓存
  db.pragma('synchronous = NORMAL');
  db.pragma('temp_store = MEMORY');

  // 初始化表
  initSchema(db);

  // 保存为单例
  globalForDb._erp_db = db;
  globalForDb._erp_db_ready = true;

  console.log('[DB] Connection established:', DB_PATH);
  return db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS stores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      cost_price REAL NOT NULL DEFAULT 0,
      selling_price REAL NOT NULL DEFAULT 0,
      image_url TEXT DEFAULT '',
      takealot_product_id TEXT DEFAULT '',
      stock_quantity INTEGER DEFAULT 0,
      stock_available INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT NOT NULL UNIQUE,
      order_date TEXT NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      selling_price REAL NOT NULL,
      cost_price REAL NOT NULL,
      platform_commission REAL NOT NULL DEFAULT 0,
      payment_fee REAL NOT NULL DEFAULT 0,
      storage_fee REAL NOT NULL DEFAULT 0,
      other_fees REAL NOT NULL DEFAULT 0,
      profit REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'completed',
      store_name TEXT NOT NULL DEFAULT 'Default Store',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS purchase_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      po_number TEXT NOT NULL UNIQUE,
      store_id INTEGER DEFAULT 0,
      store_name TEXT NOT NULL DEFAULT '',
      destination_warehouse TEXT NOT NULL DEFAULT '',
      platform_po_number TEXT DEFAULT '',
      platform_shipment_id TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      total_items INTEGER DEFAULT 0,
      total_quantity INTEGER DEFAULT 0,
      platform_response TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS purchase_order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      po_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS store_auth (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      store_name TEXT NOT NULL UNIQUE,
      api_key TEXT NOT NULL,
      api_base_url TEXT NOT NULL DEFAULT 'https://marketplace-api.takealot.com/v1',
      auth_status TEXT NOT NULL DEFAULT 'pending',
      last_sync_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS product_warehouse_stock (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      warehouse_code TEXT NOT NULL,
      warehouse_name TEXT NOT NULL DEFAULT '',
      stock_available INTEGER NOT NULL DEFAULT 0,
      stock_reserved INTEGER NOT NULL DEFAULT 0,
      stock_in_transit INTEGER NOT NULL DEFAULT 0,
      stock_total INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      UNIQUE(product_id, warehouse_code)
    );

    -- 创建索引
    CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
    CREATE INDEX IF NOT EXISTS idx_orders_product_id ON orders(product_id);
    CREATE INDEX IF NOT EXISTS idx_orders_store_name ON orders(store_name);
    CREATE INDEX IF NOT EXISTS idx_orders_order_date ON orders(order_date);
    CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
    CREATE INDEX IF NOT EXISTS idx_purchase_orders_po_number ON purchase_orders(po_number);
    CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
    CREATE INDEX IF NOT EXISTS idx_store_auth_store_name ON store_auth(store_name);
    CREATE INDEX IF NOT EXISTS idx_product_warehouse_stock_product_id ON product_warehouse_stock(product_id);
  `);
}

// 优雅关闭
process.on('beforeExit', () => {
  if (globalForDb._erp_db) {
    try {
      globalForDb._erp_db.close();
      console.log('[DB] Connection closed gracefully');
    } catch (e) {
      console.error('[DB] Error closing connection:', e);
    }
  }
});
