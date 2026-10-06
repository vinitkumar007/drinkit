const db = require('../db');
const { validate: v, errors } = require('../lib');

const MAX_PER_USER = 10;

const list = (userId) => db.prepare('SELECT id, label, address, lat, lng FROM addresses WHERE user_id = ? ORDER BY id DESC').all(userId);

function get(userId, id) {
  return db.prepare('SELECT id, label, address, lat, lng FROM addresses WHERE id = ? AND user_id = ?').get(id, userId);
}

function create(userId, body) {
  if (list(userId).length >= MAX_PER_USER) throw errors.badRequest(`Max ${MAX_PER_USER} addresses save kar sakte ho`);
  const label = v.str(body.label || 'Home', { name: 'Label', max: 30 });
  const address = v.str(body.address, { name: 'Address', min: 8, max: 300 });
  const lat = v.lat(body.lat);
  const lng = v.lng(body.lng);
  const id = db.prepare('INSERT INTO addresses (user_id, label, address, lat, lng) VALUES (?,?,?,?,?)')
    .run(userId, label, address, lat, lng).lastInsertRowid;
  return get(userId, id);
}

function remove(userId, id) {
  const r = db.prepare('DELETE FROM addresses WHERE id = ? AND user_id = ?').run(id, userId);
  if (!r.changes) throw errors.notFound('Address nahi mila');
}

module.exports = { list, get, create, remove };
