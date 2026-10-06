const db = require('../db');

// Append-only record of sensitive actions. Safe to call inside a transaction.
function log(userId, action, entity, entityId, meta) {
  db.prepare('INSERT INTO audit_log (user_id, action, entity, entity_id, meta) VALUES (?,?,?,?,?)')
    .run(userId ?? null, action, entity, entityId == null ? null : String(entityId), meta ? JSON.stringify(meta) : null);
}

function recent(limit = 100) {
  return db.prepare(`SELECT a.*, u.name AS user_name FROM audit_log a LEFT JOIN users u ON u.id = a.user_id
    ORDER BY a.id DESC LIMIT ?`).all(limit);
}

module.exports = { log, recent };
