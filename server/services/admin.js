// Back-office operations: stats, stores, riders, inventory, products, coupons.
const db = require('../db');
const { validate: v, errors } = require('../lib');
const audit = require('./audit');

function stats() {
  const totals = db.prepare("SELECT COUNT(*) orders, COALESCE(SUM(total),0) revenue FROM orders WHERE status != 'cancelled'").get();
  const today = db.prepare(`SELECT COUNT(*) orders, COALESCE(SUM(total),0) revenue FROM orders
    WHERE status != 'cancelled' AND date(created_at, '+5 hours', '+30 minutes') = date('now', '+5 hours', '+30 minutes')`).get();
  const by_status = {};
  db.prepare('SELECT status, COUNT(*) c FROM orders GROUP BY status').all().forEach((r) => (by_status[r.status] = r.c));
  const open_orders = ['placed', 'accepted', 'packed', 'out_for_delivery'].reduce((s, k) => s + (by_status[k] || 0), 0);
  const top_products = db.prepare(`SELECT oi.name, SUM(oi.qty) qty FROM order_items oi JOIN orders o ON o.id = oi.order_id
    WHERE o.status != 'cancelled' GROUP BY oi.product_id ORDER BY qty DESC LIMIT 5`).all();
  const low_stock = db.prepare(`SELECT s.id store_id, s.name store, p.id product_id, p.name product, i.stock FROM inventory i
    JOIN stores s ON s.id = i.store_id JOIN products p ON p.id = i.product_id
    WHERE i.stock <= 5 AND p.active = 1 ORDER BY i.stock, s.id LIMIT 20`).all();
  return { orders: totals.orders, revenue: totals.revenue, today, open_orders, by_status, top_products, low_stock };
}

const stores = () => db.prepare('SELECT s.*, r.min_age, r.delivery_allowed FROM stores s JOIN state_rules r ON r.state = s.state ORDER BY s.id').all();

function riders() {
  return db.prepare(`SELECT r.id, r.available, r.store_id, u.name, u.phone, s.name AS store,
      (SELECT COUNT(*) FROM orders o WHERE o.rider_id = r.id AND o.status IN ('placed','accepted','packed','out_for_delivery')) AS active_jobs,
      (SELECT COUNT(*) FROM orders o WHERE o.rider_id = r.id AND o.status = 'delivered') AS delivered
    FROM riders r JOIN users u ON u.id = r.user_id JOIN stores s ON s.id = r.store_id ORDER BY r.id`).all();
}

// ----- inventory -----
function inventory(storeId) {
  const id = v.int(storeId, { name: 'store_id', min: 1 });
  return db.prepare(`SELECT p.id product_id, p.name, p.brand, p.size_ml, p.price, p.active, c.name category, i.stock
    FROM inventory i JOIN products p ON p.id = i.product_id JOIN categories c ON c.id = p.category_id
    WHERE i.store_id = ? ORDER BY c.id, p.name`).all(id);
}

function setStock(admin, body) {
  const store_id = v.int(body.store_id, { name: 'store_id', min: 1 });
  const product_id = v.int(body.product_id, { name: 'product_id', min: 1 });
  const stock = v.int(body.stock, { name: 'Stock', min: 0, max: 100000 });
  if (!db.prepare('SELECT 1 FROM stores WHERE id = ?').get(store_id)) throw errors.notFound('Store nahi mila');
  if (!db.prepare('SELECT 1 FROM products WHERE id = ?').get(product_id)) throw errors.notFound('Product nahi mila');
  db.prepare(`INSERT INTO inventory (store_id, product_id, stock) VALUES (?,?,?)
    ON CONFLICT(store_id, product_id) DO UPDATE SET stock = excluded.stock`).run(store_id, product_id, stock);
  audit.log(admin.id, 'inventory.set', 'inventory', `${store_id}:${product_id}`, { stock });
}

// ----- products -----
function products() {
  return db.prepare(`SELECT p.*, c.name AS category FROM products p JOIN categories c ON c.id = p.category_id ORDER BY p.category_id, p.name`).all();
}

function createProduct(admin, body) {
  const category_id = v.int(body.category_id, { name: 'Category', min: 1 });
  if (!db.prepare('SELECT 1 FROM categories WHERE id = ?').get(category_id)) throw errors.notFound('Category nahi mili');
  const name = v.str(body.name, { name: 'Naam', max: 100 });
  const brand = v.optStr(body.brand, { max: 60 });
  const size_ml = v.int(body.size_ml, { name: 'Size (ml)', min: 1, max: 20000 });
  const abv = body.abv === undefined || body.abv === null || body.abv === '' ? null : v.num(body.abv, { name: 'ABV', min: 0, max: 100 });
  const price = v.int(body.price, { name: 'Price', min: 1, max: 1000000 });
  const id = db.prepare('INSERT INTO products (category_id, name, brand, size_ml, abv, price) VALUES (?,?,?,?,?,?)')
    .run(category_id, name, brand, size_ml, abv, price).lastInsertRowid;
  // Make it visible (with zero stock) in every store so admins can then set stock.
  const ins = db.prepare('INSERT OR IGNORE INTO inventory (store_id, product_id, stock) VALUES (?,?,0)');
  db.prepare('SELECT id FROM stores').all().forEach((s) => ins.run(s.id, id));
  audit.log(admin.id, 'product.create', 'product', id, { name, price });
  return { id };
}

function updateProduct(admin, idRaw, body) {
  const id = v.int(idRaw, { name: 'Product', min: 1 });
  const p = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!p) throw errors.notFound('Product nahi mila');
  const next = {
    name: body.name !== undefined ? v.str(body.name, { name: 'Naam', max: 100 }) : p.name,
    price: body.price !== undefined ? v.int(body.price, { name: 'Price', min: 1, max: 1000000 }) : p.price,
    active: body.active !== undefined ? (body.active ? 1 : 0) : p.active,
  };
  db.prepare('UPDATE products SET name = ?, price = ?, active = ? WHERE id = ?').run(next.name, next.price, next.active, id);
  audit.log(admin.id, 'product.update', 'product', id, next);
}

// ----- coupons -----
const listCoupons = () => db.prepare('SELECT * FROM coupons ORDER BY created_at DESC, code').all();

function createCoupon(admin, body) {
  const code = v.str(body.code, { name: 'Code', min: 3, max: 20 }).toUpperCase();
  if (!/^[A-Z0-9]+$/.test(code)) throw errors.badRequest('Code sirf letters/numbers ho sakta hai');
  const type = v.oneOf(body.type, ['flat', 'percent'], 'Type');
  const value = v.int(body.value, { name: 'Value', min: 1, max: type === 'percent' ? 100 : 100000 });
  const min_subtotal = v.int(body.min_subtotal ?? 0, { name: 'Min subtotal', min: 0, max: 1000000 });
  const max_discount = body.max_discount === undefined || body.max_discount === null || body.max_discount === ''
    ? null : v.int(body.max_discount, { name: 'Max discount', min: 1, max: 100000 });
  const expires_at = v.optStr(body.expires_at, { max: 30 });
  if (expires_at && isNaN(new Date(expires_at))) throw errors.badRequest('Expiry date sahi nahi hai');
  if (db.prepare('SELECT 1 FROM coupons WHERE code = ?').get(code)) throw errors.conflict('Ye coupon code pehle se hai');
  db.prepare('INSERT INTO coupons (code, type, value, min_subtotal, max_discount, expires_at) VALUES (?,?,?,?,?,?)')
    .run(code, type, value, min_subtotal, max_discount, expires_at);
  audit.log(admin.id, 'coupon.create', 'coupon', code, { type, value });
  return { code };
}

function setCouponActive(admin, codeRaw, active) {
  const code = String(codeRaw).toUpperCase();
  const r = db.prepare('UPDATE coupons SET active = ? WHERE code = ?').run(active ? 1 : 0, code);
  if (!r.changes) throw errors.notFound('Coupon nahi mila');
  audit.log(admin.id, 'coupon.toggle', 'coupon', code, { active: !!active });
}

module.exports = { stats, stores, riders, inventory, setStock, products, createProduct, updateProduct, listCoupons, createCoupon, setCouponActive };
