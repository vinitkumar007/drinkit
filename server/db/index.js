// Database connection + migration runner.
// Uses Node's built-in SQLite (node:sqlite, Node >= 22.5), so there is no native module to compile.
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const config = require('../config');

if (config.dbFile !== ':memory:') fs.mkdirSync(path.dirname(config.dbFile), { recursive: true });

const db = new DatabaseSync(config.dbFile);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');

// BEGIN IMMEDIATE takes the write lock up front, so two buyers can never both
// read "1 bottle left" and both succeed. Rolls back on any thrown error.
db.transaction = (fn) => (...args) => {
  db.exec('BEGIN IMMEDIATE');
  try {
    const out = fn(...args);
    db.exec('COMMIT');
    return out;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
};

// Applies db/migrations/*.sql in filename order, once each (tracked in schema_migrations).
function migrate() {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY, applied_at TEXT DEFAULT CURRENT_TIMESTAMP)`);
  const dir = path.join(__dirname, 'migrations');
  const done = new Set(db.prepare('SELECT name FROM schema_migrations').all().map((r) => r.name));
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    if (done.has(file)) continue;
    db.transaction(() => {
      db.exec(fs.readFileSync(path.join(dir, file), 'utf8'));
      db.prepare('INSERT INTO schema_migrations (name) VALUES (?)').run(file);
    })();
  }
}

migrate();
db.migrate = migrate;

module.exports = db;
