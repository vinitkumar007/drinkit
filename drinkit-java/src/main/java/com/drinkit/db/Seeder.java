package com.drinkit.db;

import com.drinkit.util.Dates;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * Demo data: 5 cities (each with a licensed dark store and a rider), a 36 product catalog, coupons.
 * Only seeds an empty database, so it is safe to run on every start.
 *
 * IMPORTANT: state rules, store licences and prices below are DEMO values.
 * Confirm every state's excise rules with a lawyer before real use.
 */
@Component
public class Seeder {
  private static final int DEFAULT_STOCK = 40;

  private record Store(String name, String state, String licence, double lat, double lng, double radiusKm) {}
  private record Product(int category, String name, String brand, int sizeMl, Double abv, int price) {}

  private static final List<Object[]> STATE_RULES = List.of(
      new Object[] { "Delhi", 25, 1 },
      new Object[] { "Karnataka", 21, 1 },
      new Object[] { "Maharashtra", 25, 1 },
      new Object[] { "West Bengal", 21, 1 },
      new Object[] { "Rajasthan", 21, 0 }); // home delivery not permitted -> never serviceable

  private static final List<Store> STORES = List.of(
      new Store("Drinkit Hub - Connaught Place", "Delhi", "DEMO-DL-0001", 28.6315, 77.2167, 3),
      new Store("Drinkit Hub - Saket", "Delhi", "DEMO-DL-0002", 28.5245, 77.2066, 3),
      new Store("Drinkit Hub - Indiranagar", "Karnataka", "DEMO-KA-0001", 12.9784, 77.6408, 3),
      new Store("Drinkit Hub - Bandra", "Maharashtra", "DEMO-MH-0001", 19.0596, 72.8295, 3),
      new Store("Drinkit Hub - Park Street", "West Bengal", "DEMO-WB-0001", 22.5535, 88.3523, 3));

  private static final List<Object[]> CATEGORIES = List.of(
      new Object[] { 1, "Whisky", "🥃" }, new Object[] { 2, "Beer", "🍺" }, new Object[] { 3, "Vodka", "🍸" },
      new Object[] { 4, "Rum", "🏴‍☠️" }, new Object[] { 5, "Wine", "🍷" }, new Object[] { 6, "Gin", "🫒" },
      new Object[] { 7, "Mixers & Snacks", "🧊" });

  // Position in this list + 1 = product id.
  private static final List<Product> PRODUCTS = List.of(
      // Whisky 1-6
      new Product(1, "Reserve Blended Whisky", "Highland Cask", 750, 42.8, 1250),
      new Product(1, "Barrel Select Whisky", "Highland Cask", 750, 42.8, 900),
      new Product(1, "Single Malt 12 Year", "Glen Meadow", 700, 43.0, 4200),
      new Product(1, "Smoky Single Malt", "Glen Meadow", 700, 46.0, 5200),
      new Product(1, "Classic Blended Whisky", "Royal Oak", 750, 42.8, 720),
      new Product(1, "Rye Whisky", "Royal Oak", 750, 45.0, 1650),
      // Beer 7-12
      new Product(2, "Lager 650ml", "Riverside Brewing", 650, 5.0, 180),
      new Product(2, "Wheat Beer 500ml", "Riverside Brewing", 500, 4.8, 220),
      new Product(2, "Strong Beer 650ml", "Riverside Brewing", 650, 8.0, 200),
      new Product(2, "Pale Ale 500ml", "Riverside Brewing", 500, 5.5, 260),
      new Product(2, "IPA 500ml", "Craft Hops", 500, 6.5, 290),
      new Product(2, "Stout 500ml", "Craft Hops", 500, 5.8, 310),
      // Vodka 13-16
      new Product(3, "Premium Vodka", "Frost Peak", 750, 40.0, 1100),
      new Product(3, "Citrus Vodka", "Frost Peak", 750, 40.0, 1250),
      new Product(3, "Classic Vodka", "Northern Star", 750, 40.0, 820),
      new Product(3, "Vanilla Vodka", "Northern Star", 750, 37.5, 980),
      // Rum 17-20
      new Product(4, "Dark Rum", "Island Reef", 750, 42.8, 850),
      new Product(4, "White Rum", "Island Reef", 750, 42.8, 800),
      new Product(4, "Spiced Rum", "Captain Cove", 750, 40.0, 1150),
      new Product(4, "Aged Rum 8 Year", "Captain Cove", 750, 40.0, 1900),
      // Wine 21-25
      new Product(5, "Red Wine Cabernet", "Valley Estate", 750, 13.0, 1100),
      new Product(5, "Red Wine Merlot", "Valley Estate", 750, 13.0, 950),
      new Product(5, "White Wine Chardonnay", "Valley Estate", 750, 12.5, 1000),
      new Product(5, "Rose Wine", "Sunset Vines", 750, 12.0, 890),
      new Product(5, "Sparkling Brut", "Sunset Vines", 750, 11.5, 1050),
      // Gin 26-28
      new Product(6, "London Dry Gin", "Juniper & Co", 750, 42.8, 1350),
      new Product(6, "Pink Gin", "Juniper & Co", 750, 40.0, 1450),
      new Product(6, "Botanical Gin", "Garden Still", 750, 43.0, 1800),
      // Mixers & snacks 29-36
      new Product(7, "Soda (6 pack)", "Fizzo", 600, null, 120),
      new Product(7, "Cola 2L", "Fizzo", 2000, null, 95),
      new Product(7, "Tonic Water (4 pack)", "Fizzo", 800, null, 160),
      new Product(7, "Ginger Ale (4 pack)", "Fizzo", 800, null, 170),
      new Product(7, "Salted Peanuts", "Snackly", 200, null, 60),
      new Product(7, "Masala Cashews", "Snackly", 150, null, 140),
      new Product(7, "Potato Chips", "Snackly", 150, null, 50),
      new Product(7, "Ice Pack", "Drinkit", 1000, null, 40));

  // code, type, value, min_subtotal, max_discount
  private static final List<Object[]> COUPONS = List.of(
      new Object[] { "WELCOME100", "flat", 100, 999, null },
      new Object[] { "DRINK10", "percent", 10, 0, 150 });

  // phone, name, role, store_id (riders only)
  private static final List<Object[]> STAFF = List.of(
      new Object[] { "9000000001", "Admin", "admin", null },
      new Object[] { "9000000002", "Rider CP", "rider", 1 },
      new Object[] { "9000000003", "Rider Bengaluru", "rider", 3 },
      new Object[] { "9000000004", "Rider Saket", "rider", 2 },
      new Object[] { "9000000005", "Rider Mumbai", "rider", 4 },
      new Object[] { "9000000006", "Rider Kolkata", "rider", 5 });

  private final Db db;

  public Seeder(Db db) { this.db = db; }

  /** Returns true if demo data was inserted, false if the database already had data. */
  public boolean seed() {
    Number stores = (Number) db.one("SELECT COUNT(*) AS c FROM stores").get("c");
    if (stores.longValue() > 0) return false;

    db.txRun(() -> {
      String now = Dates.nowUtc();
      for (Object[] r : STATE_RULES) {
        db.update("INSERT INTO state_rules (state, min_age, delivery_allowed) VALUES (?,?,?)", r);
      }
      for (Store s : STORES) {
        db.update("INSERT INTO stores (name, state, license_no, lat, lng, radius_km) VALUES (?,?,?,?,?,?)",
            s.name(), s.state(), s.licence(), s.lat(), s.lng(), s.radiusKm());
      }
      for (Object[] c : CATEGORIES) {
        db.update("INSERT INTO categories (id, name, emoji) VALUES (?,?,?)", c);
      }
      for (int i = 0; i < PRODUCTS.size(); i++) {
        Product p = PRODUCTS.get(i);
        db.update("INSERT INTO products (category_id, name, brand, size_ml, abv, price) VALUES (?,?,?,?,?,?)",
            p.category(), p.name(), p.brand(), p.sizeMl(), p.abv(), p.price());
        for (int s = 0; s < STORES.size(); s++) {
          db.update("INSERT INTO inventory (store_id, product_id, stock) VALUES (?,?,?)", s + 1, i + 1, DEFAULT_STOCK);
        }
      }
      for (Object[] c : COUPONS) {
        db.update("INSERT INTO coupons (code, type, value, min_subtotal, max_discount, created_at) VALUES (?,?,?,?,?,?)",
            c[0], c[1], c[2], c[3], c[4], now);
      }
      for (Object[] s : STAFF) {
        long userId = db.insert("INSERT INTO users (phone, name, role, dob, age_verified, created_at) VALUES (?,?,?,?,1,?)",
            s[0], s[1], s[2], "1990-01-01", now);
        if ("rider".equals(s[2])) db.update("INSERT INTO riders (user_id, store_id) VALUES (?,?)", userId, s[3]);
      }
    });
    return true;
  }
}
