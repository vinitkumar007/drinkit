// Order lifecycle: place, cancel, admin status changes, rider pickup/delivery/refusal.
const crypto = require('crypto');
const db = require('../db');
const config = require('../config');
const { validate: v, errors } = require('../lib');
const { ageFromDob } = require('./age');
const { findServiceableStore } = require('./stores');
const coupons = require('./coupons');
const addresses = require('./addresses');
const audit = require('./audit');

const CFG = config.orders;
const FLOW = { placed: 'accepted', accepted: 'packed', packed: 'out_for_delivery' };
const ALL_STATUSES = ['placed', 'accepted', 'packed', 'out_for_delivery', 'delivered', 'cancelled'];

// ---------- reading ----------
function addEvent(orderId, status, actorRole, note = null) {
  db.prepare('INSERT INTO order_events (order_id, status, actor_role, note) VALUES (?,?,?,?)').run(orderId, status, actorRole, note);
}

function load(id) {
  const o = db.prepare(`
    SELECT o.*, s.name AS store_name, cu.name AS customer_name, cu.phone AS customer_phone, ru.name AS rider_name
    FROM orders o
    JOIN stores s ON s.id = o.store_id
    JOIN users cu ON cu.id = o.user_id
    LEFT JOIN riders r ON r.id = o.rider_id
    LEFT JOIN users ru ON ru.id = r.user_id
    WHERE o.id = ?`).get(id);
  if (!o) return null;
  o.items = db.prepare('SELECT product_id, name, price, qty FROM order_items WHERE order_id = ?').all(id);
  o.events = db.prepare('SELECT status, actor_role, note, created_at FROM order_events WHERE order_id = ? ORDER BY id').all(id);
  return o;
}

// Only the customer who placed the order may ever see the delivery OTP.
function view(o, viewer) {
  const out = { ...o };
  delete out.otp_attempts;
  if (!viewer || viewer.id !== o.user_id) delete out.delivery_otp;
  return out;
}

function getForViewer(viewer, id) {
  const o = load(id);
  if (!o) throw errors.notFound('Order nahi mila');
  const rider = o.rider_id ? db.prepare('SELECT user_id FROM riders WHERE id = ?').get(o.rider_id) : null;
  const allowed = o.user_id === viewer.id || viewer.role === 'admin' || (rider && rider.user_id === viewer.id);
  if (!allowed) throw errors.forbidden();
  return view(o, viewer);
}

function listForUser(user) {
  return db.prepare('SELECT id FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT 50').all(user.id).map((r) => view(load(r.id), user));
}

// ---------- placing ----------
function restock(orderId) {
  const o = db.prepare('SELECT store_id FROM orders WHERE id = ?').get(orderId);
  const items = db.prepare('SELECT product_id, qty FROM order_items WHERE order_id = ?').all(orderId);
  const up = db.prepare('UPDATE inventory SET stock = stock + ? WHERE store_id = ? AND product_id = ?');
  items.forEach((i) => up.run(i.qty, o.store_id, i.product_id));
}

function placeOrder(user, body) {
  if (!user.age_verified) throw errors.forbidden('Pehle age verification complete karo');
  if (!Array.isArray(body.items) || !body.items.length) throw errors.badRequest('Cart khaali hai');

  let address, lat, lng;
  if (body.address_id) {
    const a = addresses.get(user.id, Number(body.address_id));
    if (!a) throw errors.notFound('Saved address nahi mila');
    ({ address, lat, lng } = a);
  } else {
    address = v.str(body.address, { name: 'Address', min: 8, max: 300 });
    lat = v.lat(body.lat);
    lng = v.lng(body.lng);
  }
  const payment_method = v.oneOf(body.payment_method || 'cod', ['cod', 'upi', 'card'], 'Payment method');

  const svc = findServiceableStore(lat, lng);
  if (!svc.ok) throw errors.badRequest(svc.reason);
  const store = svc.store;

  // Re-check age against THIS store's state rule (DOB may have passed a laxer state earlier).
  const age = ageFromDob(user.dob);
  if (age === null || age < store.min_age) throw errors.forbidden(`${store.state} me minimum umar ${store.min_age} saal hai.`);

  const wanted = new Map(); // product_id -> qty (duplicates merged)
  for (const it of body.items) {
    const pid = v.int(it.product_id, { name: 'Product', min: 1 });
    const qty = v.int(it.qty, { name: 'Quantity', min: 1, max: CFG.maxItemsPerOrder });
    wanted.set(pid, (wanted.get(pid) || 0) + qty);
  }
  const totalQty = [...wanted.values()].reduce((a, b) => a + b, 0);
  if (totalQty > CFG.maxItemsPerOrder) throw errors.badRequest(`Ek order me max ${CFG.maxItemsPerOrder} items allowed hain`);

  const orderId = db.transaction(() => {
    let subtotal = 0;
    const lines = [];
    for (const [pid, qty] of wanted) {
      const p = db.prepare(`SELECT p.*, i.stock FROM products p
        JOIN inventory i ON i.product_id = p.id AND i.store_id = ? WHERE p.id = ? AND p.active = 1`).get(store.id, pid);
      if (!p) throw errors.badRequest('Product available nahi hai');
      if (p.stock < qty) throw errors.conflict(`${p.name}: sirf ${p.stock} stock bacha hai`);
      // Atomic decrement: two buyers can never take the last bottle.
      const r = db.prepare('UPDATE inventory SET stock = stock - ? WHERE store_id = ? AND product_id = ? AND stock >= ?')
        .run(qty, store.id, pid, qty);
      if (r.changes !== 1) throw errors.conflict(`${p.name}: stock khatam ho gaya`);
      subtotal += p.price * qty;
      lines.push({ p, qty });
    }

    let discount = 0;
    let couponCode = null;
    if (body.coupon_code) {
      const q = coupons.quote(body.coupon_code, subtotal);
      discount = q.discount;
      couponCode = q.code;
    }
    const payable = subtotal - discount;
    const delivery_fee = payable >= CFG.freeDeliveryAbove ? 0 : CFG.deliveryFee;
    const total = payable + delivery_fee;

    const rider = db.prepare(`SELECT r.id FROM riders r WHERE r.store_id = ? AND r.available = 1
      ORDER BY (SELECT COUNT(*) FROM orders o WHERE o.rider_id = r.id AND o.status IN ('placed','accepted','packed','out_for_delivery')) ASC, r.id
      LIMIT 1`).get(store.id);

    // TODO(production): for upi/card create a gateway order (Razorpay/Cashfree) and mark paid via webhook.
    const payment_status = payment_method === 'cod' ? 'pending' : 'paid';
    const deliveryOtp = String(crypto.randomInt(1000, 10000));

    const oid = db.prepare(`INSERT INTO orders (user_id, store_id, rider_id, address, lat, lng, subtotal, delivery_fee, total,
        payment_method, payment_status, delivery_otp, eta_minutes, discount, coupon_code)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(user.id, store.id, rider ? rider.id : null, address, lat, lng, subtotal, delivery_fee, total,
        payment_method, payment_status, deliveryOtp, svc.eta_minutes, discount, couponCode).lastInsertRowid;

    const ins = db.prepare('INSERT INTO order_items (order_id, product_id, name, price, qty) VALUES (?,?,?,?,?)');
    lines.forEach(({ p, qty }) => ins.run(oid, p.id, p.name, p.price, qty));
    addEvent(oid, 'placed', 'customer');
    return oid;
  })();

  return view(load(orderId), user);
}

// ---------- customer cancel ----------
function cancelByCustomer(user, id) {
  db.transaction(() => {
    const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    if (!o || o.user_id !== user.id) throw errors.notFound('Order nahi mila');
    if (!CFG.cancellableStatuses.includes(o.status)) throw errors.conflict('Ab cancel nahi ho sakta');
    db.prepare("UPDATE orders SET status='cancelled', updated_at=CURRENT_TIMESTAMP WHERE id=?").run(id);
    restock(id);
    addEvent(id, 'cancelled', 'customer');
  })();
  return view(load(id), user);
}

// ---------- admin ----------
function adminList({ status, limit = 100 } = {}) {
  const rows = status
    ? db.prepare('SELECT id FROM orders WHERE status = ? ORDER BY id DESC LIMIT ?').all(v.oneOf(status, ALL_STATUSES, 'Status'), limit)
    : db.prepare('SELECT id FROM orders ORDER BY id DESC LIMIT ?').all(limit);
  return rows.map((r) => view(load(r.id), null));
}

function adminSetStatus(admin, id, to) {
  v.oneOf(to, ALL_STATUSES, 'Status');
  db.transaction(() => {
    const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    if (!o) throw errors.notFound('Order nahi mila');
    if (to === 'cancelled') {
      if (['delivered', 'cancelled'].includes(o.status)) throw errors.conflict('Order already closed');
      db.prepare("UPDATE orders SET status='cancelled', updated_at=CURRENT_TIMESTAMP WHERE id=?").run(id);
      restock(id);
    } else {
      if (FLOW[o.status] !== to) throw errors.conflict(`${o.status} se ${to} allowed nahi hai`);
      db.prepare('UPDATE orders SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(to, id);
    }
    addEvent(id, to, 'admin');
    audit.log(admin.id, 'order.status', 'order', id, { from: o.status, to });
  })();
  return view(load(id), null);
}

function adminAssignRider(admin, orderId, riderIdRaw) {
  const riderId = v.int(riderIdRaw, { name: 'Rider', min: 1 });
  db.transaction(() => {
    const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!o) throw errors.notFound('Order nahi mila');
    if (['delivered', 'cancelled'].includes(o.status)) throw errors.conflict('Order already closed');
    const r = db.prepare('SELECT r.*, u.name FROM riders r JOIN users u ON u.id = r.user_id WHERE r.id = ?').get(riderId);
    if (!r) throw errors.notFound('Rider nahi mila');
    if (r.store_id !== o.store_id) throw errors.badRequest('Rider is store ka nahi hai');
    db.prepare('UPDATE orders SET rider_id = ?, otp_attempts = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(riderId, orderId);
    addEvent(orderId, o.status, 'admin', `Rider assigned: ${r.name}`);
    audit.log(admin.id, 'order.assign_rider', 'order', orderId, { rider_id: riderId });
  })();
  return view(load(orderId), null);
}

// ---------- rider ----------
function riderRow(user) {
  const r = db.prepare('SELECT * FROM riders WHERE user_id = ?').get(user.id);
  if (!r) throw errors.forbidden('Rider profile nahi mila');
  return r;
}

function riderOrder(user, id) {
  const r = riderRow(user);
  const o = db.prepare('SELECT * FROM orders WHERE id = ? AND rider_id = ?').get(id, r.id);
  if (!o) throw errors.notFound('Order nahi mila');
  return o;
}

function riderJobs(user) {
  const r = riderRow(user);
  return db.prepare("SELECT id FROM orders WHERE rider_id = ? AND status IN ('packed','out_for_delivery') ORDER BY id").all(r.id)
    .map((x) => view(load(x.id), user));
}

function riderPickup(user, id) {
  const o = riderOrder(user, id);
  if (o.status !== 'packed') throw errors.conflict('Order abhi packed nahi hai');
  db.transaction(() => {
    db.prepare("UPDATE orders SET status='out_for_delivery', updated_at=CURRENT_TIMESTAMP WHERE id=?").run(id);
    addEvent(id, 'out_for_delivery', 'rider');
  })();
}

// Delivery needs the customer's OTP AND the rider confirming a physical ID check (no ID = no delivery).
function riderDeliver(user, id, body) {
  const o = riderOrder(user, id);
  if (o.status !== 'out_for_delivery') throw errors.conflict('Order out for delivery nahi hai');
  if (body.id_checked !== true) throw errors.badRequest('Customer ka original ID check karna zaroori hai');
  if (o.otp_attempts >= CFG.deliveryOtpMaxAttempts) throw errors.forbidden('Bahut zyada galat OTP. Admin se contact karo.');
  if (String(body.otp) !== o.delivery_otp) {
    db.prepare('UPDATE orders SET otp_attempts = otp_attempts + 1 WHERE id = ?').run(id);
    throw errors.badRequest('Galat delivery OTP');
  }
  db.transaction(() => {
    db.prepare(`UPDATE orders SET status='delivered', id_checked=1,
      payment_status = CASE WHEN payment_method='cod' THEN 'paid' ELSE payment_status END,
      updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(id);
    addEvent(id, 'delivered', 'rider', 'ID checked');
    audit.log(user.id, 'order.delivered', 'order', id, { id_checked: true });
  })();
}

// Customer failed ID check / underage / intoxicated: cancel and return stock.
function riderRefuse(user, id, reasonRaw) {
  const o = riderOrder(user, id);
  if (o.status !== 'out_for_delivery') throw errors.conflict('Order out for delivery nahi hai');
  const reason = v.optStr(reasonRaw, { name: 'Reason', max: 200 });
  db.transaction(() => {
    db.prepare("UPDATE orders SET status='cancelled', updated_at=CURRENT_TIMESTAMP WHERE id=?").run(id);
    restock(id);
    addEvent(id, 'cancelled', 'rider', reason || 'Delivery refused');
    audit.log(user.id, 'order.refused', 'order', id, { reason });
  })();
}

function riderSetAvailability(user, available) {
  const r = riderRow(user);
  db.prepare('UPDATE riders SET available = ? WHERE id = ?').run(available ? 1 : 0, r.id);
}

function riderProfile(user) {
  const r = riderRow(user);
  const store = db.prepare('SELECT name FROM stores WHERE id = ?').get(r.store_id);
  const stats = db.prepare(`SELECT COUNT(*) delivered FROM orders WHERE rider_id = ? AND status = 'delivered'`).get(r.id);
  const active = db.prepare("SELECT COUNT(*) c FROM orders WHERE rider_id = ? AND status IN ('packed','out_for_delivery')").get(r.id);
  return { id: r.id, store: store.name, available: !!r.available, delivered: stats.delivered, active_jobs: active.c };
}

module.exports = {
  load, view, getForViewer, listForUser, placeOrder, cancelByCustomer,
  adminList, adminSetStatus, adminAssignRider,
  riderJobs, riderPickup, riderDeliver, riderRefuse, riderSetAvailability, riderProfile,
  ALL_STATUSES,
};
