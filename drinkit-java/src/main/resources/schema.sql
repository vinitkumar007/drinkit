-- Drinkit schema (H2). Flags are 0/1 integers, timestamps are UTC strings "yyyy-MM-dd HH:mm:ss".

CREATE TABLE IF NOT EXISTS users (
  id INTEGER AUTO_INCREMENT PRIMARY KEY,
  phone VARCHAR(15) NOT NULL UNIQUE,
  name VARCHAR(100),
  role VARCHAR(20) NOT NULL DEFAULT 'customer',     -- customer | rider | admin
  dob VARCHAR(10),
  age_verified INTEGER NOT NULL DEFAULT 0,
  password_hash VARCHAR(300),
  created_at VARCHAR(19)
);

CREATE TABLE IF NOT EXISTS otps (
  phone VARCHAR(15) PRIMARY KEY,
  code VARCHAR(10) NOT NULL,
  expires_at BIGINT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0
);

-- Legal drinking age and delivery permission differ per state.
CREATE TABLE IF NOT EXISTS state_rules (
  state VARCHAR(60) PRIMARY KEY,
  min_age INTEGER NOT NULL,
  delivery_allowed INTEGER NOT NULL DEFAULT 0
);

-- A store is a licensed shop / dark store that fulfils orders.
CREATE TABLE IF NOT EXISTS stores (
  id INTEGER AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  state VARCHAR(60) NOT NULL REFERENCES state_rules(state),
  license_no VARCHAR(60) NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  radius_km DOUBLE PRECISION NOT NULL DEFAULT 3,
  open_hour INTEGER NOT NULL DEFAULT 10,
  close_hour INTEGER NOT NULL DEFAULT 22,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(60) NOT NULL UNIQUE,
  emoji VARCHAR(20)
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER AUTO_INCREMENT PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  name VARCHAR(120) NOT NULL,
  brand VARCHAR(80),
  size_ml INTEGER NOT NULL,
  abv DOUBLE PRECISION,
  price INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS inventory (
  store_id INTEGER NOT NULL REFERENCES stores(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  stock INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (store_id, product_id)
);

CREATE TABLE IF NOT EXISTS riders (
  id INTEGER AUTO_INCREMENT PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
  store_id INTEGER NOT NULL REFERENCES stores(id),
  available INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER AUTO_INCREMENT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  store_id INTEGER NOT NULL REFERENCES stores(id),
  rider_id INTEGER REFERENCES riders(id),
  status VARCHAR(20) NOT NULL DEFAULT 'placed',     -- placed|accepted|packed|out_for_delivery|delivered|cancelled
  address VARCHAR(400) NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  subtotal INTEGER NOT NULL,
  delivery_fee INTEGER NOT NULL,
  total INTEGER NOT NULL,
  payment_method VARCHAR(10) NOT NULL DEFAULT 'cod', -- cod | upi | card
  payment_status VARCHAR(10) NOT NULL DEFAULT 'pending',
  delivery_otp VARCHAR(10) NOT NULL,
  eta_minutes INTEGER NOT NULL,
  id_checked INTEGER NOT NULL DEFAULT 0,
  discount INTEGER NOT NULL DEFAULT 0,
  coupon_code VARCHAR(30),
  otp_attempts INTEGER NOT NULL DEFAULT 0,
  created_at VARCHAR(19),
  updated_at VARCHAR(19)
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER AUTO_INCREMENT PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  name VARCHAR(120) NOT NULL,
  price INTEGER NOT NULL,
  qty INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS addresses (
  id INTEGER AUTO_INCREMENT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  label VARCHAR(40) NOT NULL,
  address VARCHAR(400) NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  created_at VARCHAR(19)
);

CREATE TABLE IF NOT EXISTS coupons (
  code VARCHAR(30) PRIMARY KEY,
  type VARCHAR(10) NOT NULL,                        -- flat | percent
  value INTEGER NOT NULL,
  min_subtotal INTEGER NOT NULL DEFAULT 0,
  max_discount INTEGER,
  active INTEGER NOT NULL DEFAULT 1,
  expires_at VARCHAR(40),
  created_at VARCHAR(19)
);

-- Every status change, so customers/admins can see a timeline.
CREATE TABLE IF NOT EXISTS order_events (
  id INTEGER AUTO_INCREMENT PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  status VARCHAR(20) NOT NULL,
  actor_role VARCHAR(20) NOT NULL,                  -- customer | admin | rider | system
  note VARCHAR(300),
  created_at VARCHAR(19)
);

-- Who did what (admin changes, refusals, etc.) for accountability / excise audits.
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER AUTO_INCREMENT PRIMARY KEY,
  user_id INTEGER,
  action VARCHAR(60) NOT NULL,
  entity VARCHAR(40) NOT NULL,
  entity_id VARCHAR(60),
  meta VARCHAR(2000),
  created_at VARCHAR(19)
);

CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_rider ON orders(rider_id);
CREATE INDEX IF NOT EXISTS idx_products_cat ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_addresses_user ON addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_events_order ON order_events(order_id);
