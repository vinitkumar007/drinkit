-- Saved addresses, coupons, order timeline, audit log, delivery-OTP lockout.

CREATE TABLE addresses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  label TEXT NOT NULL,                          -- Home / Office / ...
  address TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_addresses_user ON addresses(user_id);

CREATE TABLE coupons (
  code TEXT PRIMARY KEY,
  type TEXT NOT NULL,                           -- flat | percent
  value INTEGER NOT NULL,
  min_subtotal INTEGER NOT NULL DEFAULT 0,
  max_discount INTEGER,                         -- cap for percent coupons
  active INTEGER NOT NULL DEFAULT 1,
  expires_at TEXT,                              -- ISO date, optional
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Every status change, so customers/admins can see a timeline.
CREATE TABLE order_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  status TEXT NOT NULL,
  actor_role TEXT NOT NULL,                     -- customer | admin | rider | system
  note TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_events_order ON order_events(order_id);

-- Who did what (admin changes, refusals, etc.) for accountability / excise audits.
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  meta TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE orders ADD COLUMN discount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN coupon_code TEXT;
ALTER TABLE orders ADD COLUMN otp_attempts INTEGER NOT NULL DEFAULT 0;
