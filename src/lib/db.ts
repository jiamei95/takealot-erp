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
  _erp_db_inode: number | undefined;
};

function getFileInode(): number | undefined {
  try {
    const stat = fs.statSync(DB_PATH);
    return stat.ino;
  } catch {
    return undefined;
  }
}

export function getDb(): Database.Database {
  const currentInode = getFileInode();

  // 如果文件 inode 变了（数据库被重建），必须重新连接
  if (globalForDb._erp_db && globalForDb._erp_db_inode !== currentInode) {
    try { globalForDb._erp_db.close(); } catch { /* ignore */ }
    globalForDb._erp_db = undefined;
    globalForDb._erp_db_inode = undefined;
  }

  if (globalForDb._erp_db) {
    try {
      globalForDb._erp_db.prepare('SELECT 1').get();
      return globalForDb._erp_db;
    } catch {
      try { globalForDb._erp_db.close(); } catch { /* ignore */ }
      globalForDb._erp_db = undefined;
      globalForDb._erp_db_inode = undefined;
    }
  }

  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  initSchema(db);
  globalForDb._erp_db = db;
  globalForDb._erp_db_inode = currentInode ?? getFileInode();
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
      status TEXT NOT NULL DEFAULT 'pending',
      destination_warehouse TEXT NOT NULL DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS purchase_order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      po_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      sku TEXT NOT NULL DEFAULT '',
      product_name TEXT NOT NULL DEFAULT '',
      quantity INTEGER NOT NULL DEFAULT 0,
      cost_price REAL NOT NULL DEFAULT 0,
      subtotal REAL NOT NULL DEFAULT 0,
      FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS store_auth (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      store_name TEXT NOT NULL,
      api_key TEXT NOT NULL DEFAULT '',
      api_secret TEXT NOT NULL DEFAULT '',
      api_base_url TEXT NOT NULL DEFAULT 'https://seller-api.takealot.com',
      access_token TEXT DEFAULT '',
      token_expires_at TEXT DEFAULT '',
      auth_status TEXT NOT NULL DEFAULT 'disconnected',
      last_sync_at TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Migration: add api_base_url column if not exists
  const columns = db.prepare('PRAGMA table_info(store_auth)').all() as { name: string }[];
  if (!columns.some(c => c.name === 'api_base_url')) {
    db.exec(`ALTER TABLE store_auth ADD COLUMN api_base_url TEXT NOT NULL DEFAULT 'https://seller-api.takealot.com'`);
  }
}
