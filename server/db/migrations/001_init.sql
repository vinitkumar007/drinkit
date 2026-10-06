-- Core schema. Plain SQL so it ports to PostgreSQL with minor type changes.

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT UNIQUE NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'customer',        -- customer | rider | admin
  dob TEXT,
  age_verified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE otps (
  phone TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0
);

-- Legal drinking age and delivery permission differ per state.
CREATE TABLE state_rules (
  state TEXT PRIMARY KEY,
  min_age INTEGER NOT NULL,
  delivery_allowed INTEGER NOT NULL DEFAULT 0
);

-- A store is a licensed shop / dark store that fulfils orders.
CREATE TABLE stores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  state TEXT NOT NULL REFERENCES state_rules(state),
  license_no TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  radius_km REAL NOT NULL DEFAULT 3,
  open_hour INTEGER NOT NULL DEFAULT 10,
  close_hour INTEGER NOT NULL DEFAULT 22,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  emoji TEXT
);

CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  name TEXT NOT NULL,
  brand TEXT,
  size_ml INTEGER NOT NULL,
  abv REAL,
  price INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE inventory (
  store_id INTEGER NOT NULL REFERENCES stores(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  stock INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (store_id, product_id)
);

CREATE TABLE riders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE NOT NULL REFERENCES users(id),
  store_id INTEGER NOT NULL REFERENCES stores(id),
  available INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  store_id INTEGER NOT NULL REFERENCES stores(id),
  rider_id INTEGER REFERENCES riders(id),
  status TEXT NOT NULL DEFAULT 'placed',        -- placed|accepted|packed|out_for_delivery|delivered|cancelled
  address TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  subtotal INTEGER NOT NULL,
  delivery_fee INTEGER NOT NULL,
  total INTEGER NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'cod',   -- cod | upi | card
  payment_status TEXT NOT NULL DEFAULT 'pending',
  delivery_otp TEXT NOT NULL,
  eta_minutes INTEGER NOT NULL,
  id_checked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  name TEXT NOT NULL,
  price INTEGER NOT NULL,
  qty INTEGER NOT NULL
);

CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_rider ON orders(rider_id);
CREATE INDEX idx_products_cat ON products(category_id);
