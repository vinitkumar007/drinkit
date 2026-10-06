// Demo data: 5 cities (each with a licensed dark store and a rider), a 36 product catalog, coupons.
// Safe to run any time: it only seeds an empty database.
//
// IMPORTANT: state rules, store licences and prices below are DEMO values.
// Confirm every state's excise rules with a lawyer before real use.
const db = require('./index');

const STATE_RULES = [
  // state, min_age, delivery_allowed
  ['Delhi', 25, 1],
  ['Karnataka', 21, 1],
  ['Maharashtra', 25, 1],
  ['West Bengal', 21, 1],
  ['Rajasthan', 21, 0], // home delivery not permitted -> never serviceable
];

const STORES = [
  // name, state, licence, lat, lng, radius_km   (ids 1..5 are relied on by the tests)
  ['Drinkit Hub - Connaught Place', 'Delhi', 'DEMO-DL-0001', 28.6315, 77.2167, 3],
  ['Drinkit Hub - Saket', 'Delhi', 'DEMO-DL-0002', 28.5245, 77.2066, 3],
  ['Drinkit Hub - Indiranagar', 'Karnataka', 'DEMO-KA-0001', 12.9784, 77.6408, 3],
  ['Drinkit Hub - Bandra', 'Maharashtra', 'DEMO-MH-0001', 19.0596, 72.8295, 3],
  ['Drinkit Hub - Park Street', 'West Bengal', 'DEMO-WB-0001', 22.5535, 88.3523, 3],
];

const CATEGORIES = [
  [1, 'Whisky', '🥃'], [2, 'Beer', '🍺'], [3, 'Vodka', '🍸'], [4, 'Rum', '🏴‍☠️'],
  [5, 'Wine', '🍷'], [6, 'Gin', '🫒'], [7, 'Mixers & Snacks', '🧊'],
];

// category, name, brand, size_ml, abv, price.  Array position + 1 = product id (tests rely on these).
const PRODUCTS = [
  // Whisky 1-6
  [1, 'Reserve Blended Whisky', 'Highland Cask', 750, 42.8, 1250],
  [1, 'Barrel Select Whisky', 'Highland Cask', 750, 42.8, 900],
  [1, 'Single Malt 12 Year', 'Glen Meadow', 700, 43, 4200],
  [1, 'Smoky Single Malt', 'Glen Meadow', 700, 46, 5200],
  [1, 'Classic Blended Whisky', 'Royal Oak', 750, 42.8, 720],
  [1, 'Rye Whisky', 'Royal Oak', 750, 45, 1650],
  // Beer 7-12 (4 Riverside, 2 Craft Hops)
  [2, 'Lager 650ml', 'Riverside Brewing', 650, 5, 180],
  [2, 'Wheat Beer 500ml', 'Riverside Brewing', 500, 4.8, 220],
  [2, 'Strong Beer 650ml', 'Riverside Brewing', 650, 8, 200],
  [2, 'Pale Ale 500ml', 'Riverside Brewing', 500, 5.5, 260],
  [2, 'IPA 500ml', 'Craft Hops', 500, 6.5, 290],
  [2, 'Stout 500ml', 'Craft Hops', 500, 5.8, 310],
  // Vodka 13-16
  [3, 'Premium Vodka', 'Frost Peak', 750, 40, 1100],
  [3, 'Citrus Vodka', 'Frost Peak', 750, 40, 1250],
  [3, 'Classic Vodka', 'Northern Star', 750, 40, 820],
  [3, 'Vanilla Vodka', 'Northern Star', 750, 37.5, 980],
  // Rum 17-20
  [4, 'Dark Rum', 'Island Reef', 750, 42.8, 850],
  [4, 'White Rum', 'Island Reef', 750, 42.8, 800],
  [4, 'Spiced Rum', 'Captain Cove', 750, 40, 1150],
  [4, 'Aged Rum 8 Year', 'Captain Cove', 750, 40, 1900],
  // Wine 21-25
  [5, 'Red Wine Cabernet', 'Valley Estate', 750, 13, 1100],
  [5, 'Red Wine Merlot', 'Valley Estate', 750, 13, 950],
  [5, 'White Wine Chardonnay', 'Valley Estate', 750, 12.5, 1000],
  [5, 'Rose Wine', 'Sunset Vines', 750, 12, 890],
  [5, 'Sparkling Brut', 'Sunset Vines', 750, 11.5, 1050],
  // Gin 26-28
  [6, 'London Dry Gin', 'Juniper & Co', 750, 42.8, 1350],
  [6, 'Pink Gin', 'Juniper & Co', 750, 40, 1450],
  [6, 'Botanical Gin', 'Garden Still', 750, 43, 1800],
  // Mixers & snacks 29-36
  [7, 'Soda (6 pack)', 'Fizzo', 600, null, 120],
  [7, 'Cola 2L', 'Fizzo', 2000, null, 95],
  [7, 'Tonic Water (4 pack)', 'Fizzo', 800, null, 160],
  [7, 'Ginger Ale (4 pack)', 'Fizzo', 800, null, 170],
  [7, 'Salted Peanuts', 'Snackly', 200, null, 60],
  [7, 'Masala Cashews', 'Snackly', 150, null, 140],
  [7, 'Potato Chips', 'Snackly', 150, null, 50],
  [7, 'Ice Pack', 'Drinkit', 1000, null, 40],
];

const COUPONS = [
  // code, type, value, min_subtotal, max_discount
  ['WELCOME100', 'flat', 100, 999, null],
  ['DRINK10', 'percent', 10, 0, 150],
];

const STAFF = [
  // phone, name, role, store_id (riders only)
  ['9000000001', 'Admin', 'admin', null],
  ['9000000002', 'Rider CP', 'rider', 1],
  ['9000000003', 'Rider Bengaluru', 'rider', 3],
  ['9000000004', 'Rider Saket', 'rider', 2],
  ['9000000005', 'Rider Mumbai', 'rider', 4],
  ['9000000006', 'Rider Kolkata', 'rider', 5],
];

const DEFAULT_STOCK = 40;

function seed() {
  if (db.prepare('SELECT COUNT(*) c FROM stores').get().c > 0) return false;

  db.transaction(() => {
    const rule = db.prepare('INSERT INTO state_rules (state, min_age, delivery_allowed) VALUES (?,?,?)');
    STATE_RULES.forEach((r) => rule.run(...r));

    const store = db.prepare('INSERT INTO stores (name, state, license_no, lat, lng, radius_km) VALUES (?,?,?,?,?,?)');
    STORES.forEach((s) => store.run(...s));

    const cat = db.prepare('INSERT INTO categories (id, name, emoji) VALUES (?,?,?)');
    CATEGORIES.forEach((c) => cat.run(...c));

    const prod = db.prepare('INSERT INTO products (category_id, name, brand, size_ml, abv, price) VALUES (?,?,?,?,?,?)');
    const inv = db.prepare('INSERT INTO inventory (store_id, product_id, stock) VALUES (?,?,?)');
    PRODUCTS.forEach((p, i) => {
      prod.run(...p);
      STORES.forEach((_, s) => inv.run(s + 1, i + 1, DEFAULT_STOCK));
    });

    const coupon = db.prepare('INSERT INTO coupons (code, type, value, min_subtotal, max_discount) VALUES (?,?,?,?,?)');
    COUPONS.forEach((c) => coupon.run(...c));

    const user = db.prepare('INSERT INTO users (phone, name, role, dob, age_verified) VALUES (?,?,?,?,1)');
    const rider = db.prepare('INSERT INTO riders (user_id, store_id) VALUES (?,?)');
    STAFF.forEach(([phone, name, role, storeId]) => {
      const id = user.run(phone, name, role, '1990-01-01').lastInsertRowid;
      if (role === 'rider') rider.run(id, storeId);
    });
  })();
  return true;
}

module.exports = { seed };

if (require.main === module) {
  console.log(seed() ? 'Seeded demo data.' : 'Database already has data, skipped.');
}
