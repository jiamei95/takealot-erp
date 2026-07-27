import { getDb } from './db';

function seed(): void {
  const db = getDb();

  const storeCount = db.prepare('SELECT COUNT(*) as cnt FROM stores').get() as { cnt: number };
  if (storeCount.cnt > 0) {
    console.log('Database already seeded, skipping...');
    return;
  }

  // Insert stores
  const insertStore = db.prepare('INSERT INTO stores (name) VALUES (?)');
  const stores = ['Takealot Main', 'Takealot Express', 'Takealot Marketplace'];
  for (const s of stores) {
    insertStore.run(s);
  }

  // Insert products
  const insertProduct = db.prepare(`
    INSERT INTO products (sku, name, cost_price, selling_price, image_url, takealot_product_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const products = [
    { sku: 'TK-EL-001', name: 'Wireless Bluetooth Earbuds', cost: 85, price: 299, img: '', tid: 'TL-10234' },
    { sku: 'TK-EL-002', name: 'USB-C Fast Charging Cable 2m', cost: 15, price: 79, img: '', tid: 'TL-10235' },
    { sku: 'TK-EL-003', name: 'Portable Power Bank 10000mAh', cost: 120, price: 399, img: '', tid: 'TL-10236' },
    { sku: 'TK-HM-001', name: 'Stainless Steel Water Bottle 750ml', cost: 45, price: 189, img: '', tid: 'TL-20101' },
    { sku: 'TK-HM-002', name: 'Memory Foam Pillow Standard', cost: 65, price: 249, img: '', tid: 'TL-20102' },
    { sku: 'TK-HM-003', name: 'Bamboo Cutting Board Set', cost: 55, price: 219, img: '', tid: 'TL-20103' },
    { sku: 'TK-SP-001', name: 'Yoga Mat 6mm Non-Slip', cost: 70, price: 299, img: '', tid: 'TL-30051' },
    { sku: 'TK-SP-002', name: 'Resistance Bands Set (5pcs)', cost: 30, price: 149, img: '', tid: 'TL-30052' },
    { sku: 'TK-SP-003', name: 'Adjustable Dumbbell 5-20kg', cost: 350, price: 899, img: '', tid: 'TL-30053' },
    { sku: 'TK-BY-001', name: 'Baby Organic Cotton Onesie', cost: 40, price: 159, img: '', tid: 'TL-40011' },
    { sku: 'TK-BY-002', name: 'Silicone Teething Toys Set', cost: 20, price: 99, img: '', tid: 'TL-40012' },
    { sku: 'TK-EL-004', name: 'LED Desk Lamp with USB Port', cost: 95, price: 349, img: '', tid: 'TL-10237' },
  ];

  for (const p of products) {
    insertProduct.run(p.sku, p.name, p.cost, p.price, p.img, p.tid);
  }

  // Insert orders (last 90 days)
  const insertOrder = db.prepare(`
    INSERT INTO orders (order_number, order_date, product_id, quantity, selling_price, cost_price,
      platform_commission, payment_fee, storage_fee, other_fees, profit, status, store_name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const statuses = ['completed', 'completed', 'completed', 'completed', 'shipped', 'pending', 'cancelled'];
  const now = new Date();
  let orderIdx = 0;

  for (let dayOffset = 0; dayOffset < 90; dayOffset++) {
    const date = new Date(now);
    date.setDate(date.getDate() - dayOffset);
    const dateStr = date.toISOString().split('T')[0];

    const ordersToday = Math.floor(Math.random() * 6) + 1;
    for (let j = 0; j < ordersToday; j++) {
      const prod = products[Math.floor(Math.random() * products.length)];
      const qty = Math.floor(Math.random() * 3) + 1;
      const sellPrice = prod.price;
      const costPrice = prod.cost * qty;
      const commission = +(sellPrice * qty * 0.15).toFixed(2);
      const payFee = +(sellPrice * qty * 0.025).toFixed(2);
      const storageFee = +(qty * 3.5).toFixed(2);
      const otherFee = +(Math.random() * 10).toFixed(2);
      const revenue = sellPrice * qty;
      const profit = +(revenue - costPrice - commission - payFee - storageFee - otherFee).toFixed(2);
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const store = stores[Math.floor(Math.random() * stores.length)];
      const orderNum = `TK${String(date.getFullYear()).slice(2)}${String(date.getMonth() + 1).padStart(2, '0')}${String(++orderIdx).padStart(5, '0')}`;

      insertOrder.run(orderNum, dateStr, products.indexOf(prod) + 1, qty, sellPrice, costPrice, commission, payFee, storageFee, otherFee, profit, status, store);
    }
  }

  // Insert some purchase orders
  const insertPO = db.prepare(`INSERT INTO purchase_orders (po_number, status, notes) VALUES (?, ?, ?)`);
  const insertPOItem = db.prepare(`INSERT INTO purchase_order_items (po_id, product_id, quantity) VALUES (?, ?, ?)`);

  const poData = [
    { num: 'PO-2025-001', status: 'delivered', notes: 'Restock electronics', items: [{ pid: 1, qty: 100 }, { pid: 2, qty: 200 }, { pid: 3, qty: 50 }] },
    { num: 'PO-2025-002', status: 'shipped', notes: 'Home goods replenishment', items: [{ pid: 4, qty: 80 }, { pid: 5, qty: 60 }] },
    { num: 'PO-2025-003', status: 'pending', notes: 'Sports equipment order', items: [{ pid: 7, qty: 40 }, { pid: 8, qty: 100 }, { pid: 9, qty: 20 }] },
  ];

  for (const po of poData) {
    const result = insertPO.run(po.num, po.status, po.notes);
    const poId = result.lastInsertRowid;
    for (const item of po.items) {
      insertPOItem.run(poId, item.pid, item.qty);
    }
  }

  // Insert store auth records
  const insertStoreAuth = db.prepare(`
    INSERT INTO store_auth (store_name, api_key, api_secret, access_token, auth_status, last_sync_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  insertStoreAuth.run('Takealot Main', 'tak_seller_key_main_2025', 'secret_main_abc123', 'tok_main_xyz789', 'connected', '2026-05-10 08:30:00');
  insertStoreAuth.run('Takealot Express', 'tak_seller_key_express_2025', 'secret_express_def456', '', 'disconnected', '');

  console.log('Database seeded successfully!');
  console.log(`  - ${stores.length} stores`);
  console.log(`  - ${products.length} products`);
  console.log(`  - ${orderIdx} orders`);
  console.log(`  - ${poData.length} purchase orders`);
  console.log('  - 2 store auth records');
}

seed();
