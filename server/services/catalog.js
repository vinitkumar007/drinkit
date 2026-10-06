const db = require('../db');
const { badRequest } = require('../lib/errors');

function categories() {
  return db.prepare('SELECT * FROM categories ORDER BY id').all();
}

function productsForStore(storeId, { category, q } = {}) {
  if (!storeId) throw badRequest('store_id chahiye (pehle serviceability check karo)');
  const params = [storeId];
  let sql = `SELECT p.id, p.name, p.brand, p.size_ml, p.abv, p.price, p.category_id, c.name AS category, i.stock
    FROM products p JOIN categories c ON c.id = p.category_id
    JOIN inventory i ON i.product_id = p.id AND i.store_id = ?
    WHERE p.active = 1`;
  if (category) { sql += ' AND p.category_id = ?'; params.push(Number(category)); }
  if (q) { sql += ' AND (p.name LIKE ? OR p.brand LIKE ?)'; const like = `%${String(q).slice(0, 50)}%`; params.push(like, like); }
  sql += ' ORDER BY p.category_id, p.name';
  return db.prepare(sql).all(...params);
}

module.exports = { categories, productsForStore };
