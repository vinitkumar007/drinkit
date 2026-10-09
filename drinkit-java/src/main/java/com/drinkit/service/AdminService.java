package com.drinkit.service;

import com.drinkit.common.HttpError;
import com.drinkit.common.M;
import com.drinkit.common.Validate;
import com.drinkit.db.Db;
import com.drinkit.util.Dates;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;

/** Back-office operations: stats, stores, riders, inventory, products, coupons. */
@Service
public class AdminService {
  private static final List<String> OPEN_STATUSES = List.of("placed", "accepted", "packed", "out_for_delivery");
  private static final Pattern CODE = Pattern.compile("^[A-Z0-9]+$");

  private final Db db;
  private final AuditService audit;

  public AdminService(Db db, AuditService audit) {
    this.db = db;
    this.audit = audit;
  }

  public Map<String, Object> stats() {
    Map<String, Object> totals = db.one("SELECT COUNT(*) AS orders, COALESCE(SUM(total), 0) AS revenue FROM orders WHERE status <> 'cancelled'");
    String[] day = Dates.istTodayBoundsUtc();
    Map<String, Object> today = db.one("SELECT COUNT(*) AS orders, COALESCE(SUM(total), 0) AS revenue FROM orders "
        + "WHERE status <> 'cancelled' AND created_at >= ? AND created_at < ?", day[0], day[1]);

    Map<String, Object> byStatus = new LinkedHashMap<>();
    for (Map<String, Object> r : db.list("SELECT status, COUNT(*) AS c FROM orders GROUP BY status")) {
      byStatus.put(M.s(r, "status"), r.get("c"));
    }
    long open = 0;
    for (String s : OPEN_STATUSES) open += byStatus.get(s) == null ? 0 : ((Number) byStatus.get(s)).longValue();

    List<Map<String, Object>> top = db.list("SELECT oi.name AS name, SUM(oi.qty) AS qty FROM order_items oi "
        + "JOIN orders o ON o.id = oi.order_id WHERE o.status <> 'cancelled' "
        + "GROUP BY oi.product_id, oi.name ORDER BY SUM(oi.qty) DESC LIMIT 5");
    List<Map<String, Object>> low = db.list("SELECT s.id AS store_id, s.name AS store, p.id AS product_id, p.name AS product, i.stock AS stock "
        + "FROM inventory i JOIN stores s ON s.id = i.store_id JOIN products p ON p.id = i.product_id "
        + "WHERE i.stock <= 5 AND p.active = 1 ORDER BY i.stock, s.id LIMIT 20");

    Map<String, Object> out = new LinkedHashMap<>();
    out.put("orders", totals.get("orders"));
    out.put("revenue", totals.get("revenue"));
    out.put("today", today);
    out.put("open_orders", open);
    out.put("by_status", byStatus);
    out.put("top_products", top);
    out.put("low_stock", low);
    return out;
  }

  public List<Map<String, Object>> stores() {
    return db.list("SELECT s.*, r.min_age, r.delivery_allowed FROM stores s JOIN state_rules r ON r.state = s.state ORDER BY s.id");
  }

  public List<Map<String, Object>> riders() {
    return db.list("SELECT r.id, r.available, r.store_id, u.name, u.phone, s.name AS store, "
        + "(SELECT COUNT(*) FROM orders o WHERE o.rider_id = r.id AND o.status IN ('placed','accepted','packed','out_for_delivery')) AS active_jobs, "
        + "(SELECT COUNT(*) FROM orders o WHERE o.rider_id = r.id AND o.status = 'delivered') AS delivered "
        + "FROM riders r JOIN users u ON u.id = r.user_id JOIN stores s ON s.id = r.store_id ORDER BY r.id");
  }

  // ----- inventory -----
  public List<Map<String, Object>> inventory(Object storeIdRaw) {
    int id = Validate.integer(storeIdRaw, "store_id", 1, 1_000_000_000L);
    return db.list("SELECT p.id AS product_id, p.name, p.brand, p.size_ml, p.price, p.active, c.name AS category, i.stock "
        + "FROM inventory i JOIN products p ON p.id = i.product_id JOIN categories c ON c.id = p.category_id "
        + "WHERE i.store_id = ? ORDER BY c.id, p.name", id);
  }

  public void setStock(Map<String, Object> admin, Map<String, Object> body) {
    int storeId = Validate.integer(body.get("store_id"), "store_id", 1, 1_000_000_000L);
    int productId = Validate.integer(body.get("product_id"), "product_id", 1, 1_000_000_000L);
    int stock = Validate.integer(body.get("stock"), "Stock", 0, 100000);
    if (db.one("SELECT 1 AS x FROM stores WHERE id = ?", storeId) == null) throw HttpError.notFound("Store nahi mila");
    if (db.one("SELECT 1 AS x FROM products WHERE id = ?", productId) == null) throw HttpError.notFound("Product nahi mila");
    int changed = db.update("UPDATE inventory SET stock = ? WHERE store_id = ? AND product_id = ?", stock, storeId, productId);
    if (changed == 0) db.update("INSERT INTO inventory (store_id, product_id, stock) VALUES (?,?,?)", storeId, productId, stock);
    audit.log(M.l(admin, "id"), "inventory.set", "inventory", storeId + ":" + productId, meta("stock", stock));
  }

  // ----- products -----
  public List<Map<String, Object>> products() {
    return db.list("SELECT p.*, c.name AS category FROM products p JOIN categories c ON c.id = p.category_id ORDER BY p.category_id, p.name");
  }

  public Map<String, Object> createProduct(Map<String, Object> admin, Map<String, Object> body) {
    int categoryId = Validate.integer(body.get("category_id"), "Category", 1, 1_000_000_000L);
    if (db.one("SELECT 1 AS x FROM categories WHERE id = ?", categoryId) == null) throw HttpError.notFound("Category nahi mili");
    String name = Validate.str(body.get("name"), "Naam", 1, 100);
    String brand = Validate.optStr(body.get("brand"), "Value", 60);
    int sizeMl = Validate.integer(body.get("size_ml"), "Size (ml)", 1, 20000);
    Object abvRaw = body.get("abv");
    Double abv = abvRaw == null || "".equals(abvRaw) ? null : Validate.num(abvRaw, "ABV", 0, 100);
    int price = Validate.integer(body.get("price"), "Price", 1, 1000000);

    long id = db.tx(() -> {
      long pid = db.insert("INSERT INTO products (category_id, name, brand, size_ml, abv, price) VALUES (?,?,?,?,?,?)",
          categoryId, name, brand, sizeMl, abv, price);
      // Make it visible (with zero stock) in every store so admins can then set stock.
      for (Map<String, Object> s : db.list("SELECT id FROM stores")) {
        db.update("INSERT INTO inventory (store_id, product_id, stock) VALUES (?,?,0)", s.get("id"), pid);
      }
      return pid;
    });
    audit.log(M.l(admin, "id"), "product.create", "product", id, meta("name", name, "price", price));
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("id", id);
    return out;
  }

  public void updateProduct(Map<String, Object> admin, Object idRaw, Map<String, Object> body) {
    int id = Validate.integer(idRaw, "Product", 1, 1_000_000_000L);
    Map<String, Object> p = db.one("SELECT * FROM products WHERE id = ?", id);
    if (p == null) throw HttpError.notFound("Product nahi mila");
    String name = body.get("name") != null ? Validate.str(body.get("name"), "Naam", 1, 100) : M.s(p, "name");
    int price = body.get("price") != null ? Validate.integer(body.get("price"), "Price", 1, 1000000) : M.i(p, "price");
    int active = body.get("active") != null ? (Validate.truthy(body.get("active")) ? 1 : 0) : M.i(p, "active");
    db.update("UPDATE products SET name = ?, price = ?, active = ? WHERE id = ?", name, price, active, id);
    audit.log(M.l(admin, "id"), "product.update", "product", id, meta("name", name, "price", price, "active", active));
  }

  // ----- coupons -----
  public List<Map<String, Object>> listCoupons() {
    return db.list("SELECT * FROM coupons ORDER BY created_at DESC, code");
  }

  public Map<String, Object> createCoupon(Map<String, Object> admin, Map<String, Object> body) {
    String code = Validate.str(body.get("code"), "Code", 3, 20).toUpperCase(Locale.ROOT);
    if (!CODE.matcher(code).matches()) throw HttpError.badRequest("Code sirf letters/numbers ho sakta hai");
    String type = Validate.oneOf(body.get("type"), List.of("flat", "percent"), "Type");
    int value = Validate.integer(body.get("value"), "Value", 1, "percent".equals(type) ? 100 : 100000);
    int minSubtotal = Validate.integer(body.get("min_subtotal") == null ? 0 : body.get("min_subtotal"), "Min subtotal", 0, 1000000);
    Object maxRaw = body.get("max_discount");
    Integer maxDiscount = maxRaw == null || "".equals(maxRaw) ? null : Validate.integer(maxRaw, "Max discount", 1, 100000);
    String expiresAt = Validate.optStr(body.get("expires_at"), "Value", 30);
    if (expiresAt != null && Dates.parse(expiresAt) == null) throw HttpError.badRequest("Expiry date sahi nahi hai");
    if (db.one("SELECT 1 AS x FROM coupons WHERE code = ?", code) != null) throw HttpError.conflict("Ye coupon code pehle se hai");
    db.update("INSERT INTO coupons (code, type, value, min_subtotal, max_discount, expires_at, created_at) VALUES (?,?,?,?,?,?,?)",
        code, type, value, minSubtotal, maxDiscount, expiresAt, Dates.nowUtc());
    audit.log(M.l(admin, "id"), "coupon.create", "coupon", code, meta("type", type, "value", value));
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("code", code);
    return out;
  }

  public void setCouponActive(Map<String, Object> admin, String codeRaw, boolean active) {
    String code = codeRaw.toUpperCase(Locale.ROOT);
    int changed = db.update("UPDATE coupons SET active = ? WHERE code = ?", active ? 1 : 0, code);
    if (changed == 0) throw HttpError.notFound("Coupon nahi mila");
    audit.log(M.l(admin, "id"), "coupon.toggle", "coupon", code, meta("active", active));
  }

  private static Map<String, Object> meta(Object... kv) {
    Map<String, Object> m = new LinkedHashMap<>();
    for (int i = 0; i + 1 < kv.length; i += 2) m.put(String.valueOf(kv[i]), kv[i + 1]);
    return m;
  }
}
