package com.drinkit.service;

import com.drinkit.common.HttpError;
import com.drinkit.common.M;
import com.drinkit.common.Validate;
import com.drinkit.config.AppConfig;
import com.drinkit.db.Db;
import com.drinkit.util.AgeRules;
import com.drinkit.util.Dates;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/** Order lifecycle: place, cancel, admin status changes, rider pickup/delivery/refusal. */
@Service
public class OrderService {
  /** admin can only move an order one step forward: placed -> accepted -> packed -> out_for_delivery */
  private static final Map<String, String> FLOW =
      Map.of("placed", "accepted", "accepted", "packed", "packed", "out_for_delivery");
  public static final List<String> ALL_STATUSES =
      List.of("placed", "accepted", "packed", "out_for_delivery", "delivered", "cancelled");
  private static final SecureRandom RNG = new SecureRandom();
  private static final String ACTIVE = "('placed','accepted','packed','out_for_delivery')";

  private final Db db;
  private final StoreService stores;
  private final CouponService coupons;
  private final AddressService addresses;
  private final AuditService audit;

  public OrderService(Db db, StoreService stores, CouponService coupons, AddressService addresses, AuditService audit) {
    this.db = db;
    this.stores = stores;
    this.coupons = coupons;
    this.addresses = addresses;
    this.audit = audit;
  }

  // ---------- reading ----------
  private void addEvent(long orderId, String status, String actorRole, String note) {
    db.update("INSERT INTO order_events (order_id, status, actor_role, note, created_at) VALUES (?,?,?,?,?)",
        orderId, status, actorRole, note, Dates.nowUtc());
  }

  /** The order with store/customer/rider names, its items and its timeline. Null if it does not exist. */
  public Map<String, Object> load(long id) {
    Map<String, Object> o = db.one(
        "SELECT o.*, s.name AS store_name, cu.name AS customer_name, cu.phone AS customer_phone, ru.name AS rider_name "
        + "FROM orders o JOIN stores s ON s.id = o.store_id JOIN users cu ON cu.id = o.user_id "
        + "LEFT JOIN riders r ON r.id = o.rider_id LEFT JOIN users ru ON ru.id = r.user_id "
        + "WHERE o.id = ?", id);
    if (o == null) return null;
    o.put("items", db.list("SELECT product_id, name, price, qty FROM order_items WHERE order_id = ? ORDER BY id", id));
    o.put("events", db.list("SELECT status, actor_role, note, created_at FROM order_events WHERE order_id = ? ORDER BY id", id));
    return o;
  }

  /** Only the customer who placed the order may ever see the delivery OTP. */
  public Map<String, Object> view(Map<String, Object> o, Map<String, Object> viewer) {
    Map<String, Object> out = new LinkedHashMap<>(o);
    out.remove("otp_attempts");
    if (viewer == null || M.l(viewer, "id") != M.l(o, "user_id")) out.remove("delivery_otp");
    return out;
  }

  public Map<String, Object> getForViewer(Map<String, Object> viewer, long id) {
    Map<String, Object> o = load(id);
    if (o == null) throw HttpError.notFound("Order nahi mila");
    boolean allowed = M.l(o, "user_id") == M.l(viewer, "id") || "admin".equals(M.s(viewer, "role"));
    if (!allowed && o.get("rider_id") != null) {
      Map<String, Object> rider = db.one("SELECT user_id FROM riders WHERE id = ?", o.get("rider_id"));
      allowed = rider != null && M.l(rider, "user_id") == M.l(viewer, "id");
    }
    if (!allowed) throw HttpError.forbidden();
    return view(o, viewer);
  }

  public List<Map<String, Object>> listForUser(Map<String, Object> user) {
    List<Map<String, Object>> out = new ArrayList<>();
    for (Map<String, Object> r : db.list("SELECT id FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT 50", user.get("id"))) {
      out.add(view(load(M.l(r, "id")), user));
    }
    return out;
  }

  // ---------- placing ----------
  private void restock(long orderId) {
    Map<String, Object> o = db.one("SELECT store_id FROM orders WHERE id = ?", orderId);
    for (Map<String, Object> i : db.list("SELECT product_id, qty FROM order_items WHERE order_id = ?", orderId)) {
      db.update("UPDATE inventory SET stock = stock + ? WHERE store_id = ? AND product_id = ?",
          i.get("qty"), o.get("store_id"), i.get("product_id"));
    }
  }

  @SuppressWarnings("unchecked")
  public Map<String, Object> placeOrder(Map<String, Object> user, Map<String, Object> body) {
    if (M.i(user, "age_verified") == 0) throw HttpError.forbidden("Pehle age verification complete karo");
    Object itemsRaw = body.get("items");
    if (!(itemsRaw instanceof List<?> items) || items.isEmpty()) throw HttpError.badRequest("Cart khaali hai");

    final String address;
    final double lat;
    final double lng;
    if (Validate.truthy(body.get("address_id"))) {
      double idn = Validate.toNumber(body.get("address_id"));
      Map<String, Object> a = Double.isNaN(idn) ? null : addresses.get(M.l(user, "id"), (long) idn);
      if (a == null) throw HttpError.notFound("Saved address nahi mila");
      address = M.s(a, "address");
      lat = M.d(a, "lat");
      lng = M.d(a, "lng");
    } else {
      address = Validate.str(body.get("address"), "Address", 8, 300);
      lat = Validate.lat(body.get("lat"));
      lng = Validate.lng(body.get("lng"));
    }
    final String paymentMethod = Validate.oneOf(
        Validate.truthy(body.get("payment_method")) ? body.get("payment_method") : "cod",
        List.of("cod", "upi", "card"), "Payment method");

    StoreService.Serviceability svc = stores.findServiceableStore(lat, lng);
    if (!svc.ok()) throw HttpError.badRequest(svc.reason());
    final Map<String, Object> store = svc.store();
    final long storeId = M.l(store, "id");

    // Re-check age against THIS store's state rule.
    Integer age = AgeRules.ageFromDob(user.get("dob"));
    int minAge = M.i(store, "min_age");
    if (age == null || age < minAge) {
      throw HttpError.forbidden(M.s(store, "state") + " me minimum umar " + minAge + " saal hai.");
    }

    // product_id -> qty (duplicates merged)
    final Map<Integer, Integer> wanted = new LinkedHashMap<>();
    int totalQty = 0;
    for (Object it : items) {
      Map<String, Object> m = it instanceof Map ? (Map<String, Object>) it : Map.of();
      int pid = Validate.integer(m.get("product_id"), "Product", 1, 1_000_000_000L);
      int qty = Validate.integer(m.get("qty"), "Quantity", 1, AppConfig.MAX_ITEMS_PER_ORDER);
      wanted.merge(pid, qty, Integer::sum);
      totalQty += qty;
    }
    if (totalQty > AppConfig.MAX_ITEMS_PER_ORDER) {
      throw HttpError.badRequest("Ek order me max " + AppConfig.MAX_ITEMS_PER_ORDER + " items allowed hain");
    }

    final Object couponRaw = body.get("coupon_code");
    final boolean useCoupon = Validate.truthy(couponRaw);
    final int etaMinutes = svc.etaMinutes();

    long orderId = db.tx(() -> {
      int subtotal = 0;
      List<Map<String, Object>> lines = new ArrayList<>();
      List<Integer> qtys = new ArrayList<>();
      for (Map.Entry<Integer, Integer> e : wanted.entrySet()) {
        int pid = e.getKey();
        int qty = e.getValue();
        Map<String, Object> p = db.one("SELECT p.*, i.stock FROM products p "
            + "JOIN inventory i ON i.product_id = p.id AND i.store_id = ? WHERE p.id = ? AND p.active = 1", storeId, pid);
        if (p == null) throw HttpError.badRequest("Product available nahi hai");
        if (M.i(p, "stock") < qty) throw HttpError.conflict(M.s(p, "name") + ": sirf " + M.i(p, "stock") + " stock bacha hai");
        // Atomic decrement: two buyers can never take the last bottle.
        int changed = db.update("UPDATE inventory SET stock = stock - ? WHERE store_id = ? AND product_id = ? AND stock >= ?",
            qty, storeId, pid, qty);
        if (changed != 1) throw HttpError.conflict(M.s(p, "name") + ": stock khatam ho gaya");
        subtotal += M.i(p, "price") * qty;
        lines.add(p);
        qtys.add(qty);
      }

      int discount = 0;
      String couponCode = null;
      if (useCoupon) {
        Map<String, Object> q = coupons.quote(couponRaw, subtotal);
        discount = M.i(q, "discount");
        couponCode = M.s(q, "code");
      }
      int payable = subtotal - discount;
      int deliveryFee = payable >= AppConfig.FREE_DELIVERY_ABOVE ? 0 : AppConfig.DELIVERY_FEE;
      int total = payable + deliveryFee;

      Map<String, Object> rider = db.one("SELECT r.id FROM riders r WHERE r.store_id = ? AND r.available = 1 "
          + "ORDER BY (SELECT COUNT(*) FROM orders o WHERE o.rider_id = r.id AND o.status IN " + ACTIVE + ") ASC, r.id LIMIT 1", storeId);

      // TODO(production): for upi/card create a gateway order (Razorpay/Cashfree) and mark paid via webhook.
      String paymentStatus = "cod".equals(paymentMethod) ? "pending" : "paid";
      String deliveryOtp = String.valueOf(1000 + RNG.nextInt(9000));
      String now = Dates.nowUtc();

      long oid = db.insert("INSERT INTO orders (user_id, store_id, rider_id, address, lat, lng, subtotal, delivery_fee, total, "
          + "payment_method, payment_status, delivery_otp, eta_minutes, discount, coupon_code, created_at, updated_at) "
          + "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
          user.get("id"), storeId, rider == null ? null : rider.get("id"), address, lat, lng, subtotal, deliveryFee, total,
          paymentMethod, paymentStatus, deliveryOtp, etaMinutes, discount, couponCode, now, now);

      for (int i = 0; i < lines.size(); i++) {
        Map<String, Object> p = lines.get(i);
        db.update("INSERT INTO order_items (order_id, product_id, name, price, qty) VALUES (?,?,?,?,?)",
            oid, p.get("id"), p.get("name"), p.get("price"), qtys.get(i));
      }
      addEvent(oid, "placed", "customer", null);
      return oid;
    });

    return view(load(orderId), user);
  }

  // ---------- customer cancel ----------
  public Map<String, Object> cancelByCustomer(Map<String, Object> user, long id) {
    db.txRun(() -> {
      Map<String, Object> o = db.one("SELECT * FROM orders WHERE id = ?", id);
      if (o == null || M.l(o, "user_id") != M.l(user, "id")) throw HttpError.notFound("Order nahi mila");
      if (!AppConfig.CANCELLABLE_STATUSES.contains(M.s(o, "status"))) throw HttpError.conflict("Ab cancel nahi ho sakta");
      db.update("UPDATE orders SET status = 'cancelled', updated_at = ? WHERE id = ?", Dates.nowUtc(), id);
      restock(id);
      addEvent(id, "cancelled", "customer", null);
    });
    return view(load(id), user);
  }

  // ---------- admin ----------
  public List<Map<String, Object>> adminList(String status) {
    List<Map<String, Object>> rows = status != null && !status.isEmpty()
        ? db.list("SELECT id FROM orders WHERE status = ? ORDER BY id DESC LIMIT 100", Validate.oneOf(status, ALL_STATUSES, "Status"))
        : db.list("SELECT id FROM orders ORDER BY id DESC LIMIT 100");
    List<Map<String, Object>> out = new ArrayList<>();
    for (Map<String, Object> r : rows) out.add(view(load(M.l(r, "id")), null));
    return out;
  }

  public Map<String, Object> adminSetStatus(Map<String, Object> admin, long id, Object toRaw) {
    final String to = Validate.oneOf(toRaw, ALL_STATUSES, "Status");
    db.txRun(() -> {
      Map<String, Object> o = db.one("SELECT * FROM orders WHERE id = ?", id);
      if (o == null) throw HttpError.notFound("Order nahi mila");
      String from = M.s(o, "status");
      if ("cancelled".equals(to)) {
        if ("delivered".equals(from) || "cancelled".equals(from)) throw HttpError.conflict("Order already closed");
        db.update("UPDATE orders SET status = 'cancelled', updated_at = ? WHERE id = ?", Dates.nowUtc(), id);
        restock(id);
      } else {
        if (!to.equals(FLOW.get(from))) throw HttpError.conflict(from + " se " + to + " allowed nahi hai");
        db.update("UPDATE orders SET status = ?, updated_at = ? WHERE id = ?", to, Dates.nowUtc(), id);
      }
      addEvent(id, to, "admin", null);
      audit.log(M.l(admin, "id"), "order.status", "order", id, meta("from", from, "to", to));
    });
    return view(load(id), null);
  }

  public Map<String, Object> adminAssignRider(Map<String, Object> admin, long orderId, Object riderIdRaw) {
    final int riderId = Validate.integer(riderIdRaw, "Rider", 1, 1_000_000_000L);
    db.txRun(() -> {
      Map<String, Object> o = db.one("SELECT * FROM orders WHERE id = ?", orderId);
      if (o == null) throw HttpError.notFound("Order nahi mila");
      String status = M.s(o, "status");
      if ("delivered".equals(status) || "cancelled".equals(status)) throw HttpError.conflict("Order already closed");
      Map<String, Object> r = db.one("SELECT r.*, u.name FROM riders r JOIN users u ON u.id = r.user_id WHERE r.id = ?", riderId);
      if (r == null) throw HttpError.notFound("Rider nahi mila");
      if (M.l(r, "store_id") != M.l(o, "store_id")) throw HttpError.badRequest("Rider is store ka nahi hai");
      db.update("UPDATE orders SET rider_id = ?, otp_attempts = 0, updated_at = ? WHERE id = ?", riderId, Dates.nowUtc(), orderId);
      addEvent(orderId, status, "admin", "Rider assigned: " + M.s(r, "name"));
      audit.log(M.l(admin, "id"), "order.assign_rider", "order", orderId, meta("rider_id", riderId));
    });
    return view(load(orderId), null);
  }

  // ---------- rider ----------
  private Map<String, Object> riderRow(Map<String, Object> user) {
    Map<String, Object> r = db.one("SELECT * FROM riders WHERE user_id = ?", user.get("id"));
    if (r == null) throw HttpError.forbidden("Rider profile nahi mila");
    return r;
  }

  private Map<String, Object> riderOrder(Map<String, Object> user, long id) {
    Map<String, Object> r = riderRow(user);
    Map<String, Object> o = db.one("SELECT * FROM orders WHERE id = ? AND rider_id = ?", id, r.get("id"));
    if (o == null) throw HttpError.notFound("Order nahi mila");
    return o;
  }

  public List<Map<String, Object>> riderJobs(Map<String, Object> user) {
    Map<String, Object> r = riderRow(user);
    List<Map<String, Object>> out = new ArrayList<>();
    for (Map<String, Object> x : db.list(
        "SELECT id FROM orders WHERE rider_id = ? AND status IN ('packed','out_for_delivery') ORDER BY id", r.get("id"))) {
      out.add(view(load(M.l(x, "id")), user));
    }
    return out;
  }

  public void riderPickup(Map<String, Object> user, long id) {
    Map<String, Object> o = riderOrder(user, id);
    if (!"packed".equals(M.s(o, "status"))) throw HttpError.conflict("Order abhi packed nahi hai");
    db.txRun(() -> {
      db.update("UPDATE orders SET status = 'out_for_delivery', updated_at = ? WHERE id = ?", Dates.nowUtc(), id);
      addEvent(id, "out_for_delivery", "rider", null);
    });
  }

  /** Delivery needs the customer's OTP AND the rider confirming a physical ID check (no ID = no delivery). */
  public void riderDeliver(Map<String, Object> user, long id, Map<String, Object> body) {
    Map<String, Object> o = riderOrder(user, id);
    if (!"out_for_delivery".equals(M.s(o, "status"))) throw HttpError.conflict("Order out for delivery nahi hai");
    if (!Boolean.TRUE.equals(body.get("id_checked"))) throw HttpError.badRequest("Customer ka original ID check karna zaroori hai");
    if (M.i(o, "otp_attempts") >= AppConfig.DELIVERY_OTP_MAX_ATTEMPTS) {
      throw HttpError.forbidden("Bahut zyada galat OTP. Admin se contact karo.");
    }
    if (!String.valueOf(body.get("otp")).equals(M.s(o, "delivery_otp"))) {
      db.update("UPDATE orders SET otp_attempts = otp_attempts + 1 WHERE id = ?", id);
      throw HttpError.badRequest("Galat delivery OTP");
    }
    db.txRun(() -> {
      db.update("UPDATE orders SET status = 'delivered', id_checked = 1, "
          + "payment_status = CASE WHEN payment_method = 'cod' THEN 'paid' ELSE payment_status END, "
          + "updated_at = ? WHERE id = ?", Dates.nowUtc(), id);
      addEvent(id, "delivered", "rider", "ID checked");
      audit.log(M.l(user, "id"), "order.delivered", "order", id, meta("id_checked", true));
    });
  }

  /** Customer failed ID check / underage / intoxicated: cancel and return stock. */
  public void riderRefuse(Map<String, Object> user, long id, Object reasonRaw) {
    Map<String, Object> o = riderOrder(user, id);
    if (!"out_for_delivery".equals(M.s(o, "status"))) throw HttpError.conflict("Order out for delivery nahi hai");
    final String reason = Validate.optStr(reasonRaw, "Reason", 200);
    db.txRun(() -> {
      db.update("UPDATE orders SET status = 'cancelled', updated_at = ? WHERE id = ?", Dates.nowUtc(), id);
      restock(id);
      addEvent(id, "cancelled", "rider", reason != null && !reason.isEmpty() ? reason : "Delivery refused");
      audit.log(M.l(user, "id"), "order.refused", "order", id, meta("reason", reason));
    });
  }

  public void riderSetAvailability(Map<String, Object> user, boolean available) {
    Map<String, Object> r = riderRow(user);
    db.update("UPDATE riders SET available = ? WHERE id = ?", available ? 1 : 0, r.get("id"));
  }

  public Map<String, Object> riderProfile(Map<String, Object> user) {
    Map<String, Object> r = riderRow(user);
    Map<String, Object> store = db.one("SELECT name FROM stores WHERE id = ?", r.get("store_id"));
    Map<String, Object> delivered = db.one("SELECT COUNT(*) AS c FROM orders WHERE rider_id = ? AND status = 'delivered'", r.get("id"));
    Map<String, Object> active = db.one(
        "SELECT COUNT(*) AS c FROM orders WHERE rider_id = ? AND status IN ('packed','out_for_delivery')", r.get("id"));
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("id", r.get("id"));
    out.put("store", store.get("name"));
    out.put("available", M.i(r, "available") != 0);
    out.put("delivered", delivered.get("c"));
    out.put("active_jobs", active.get("c"));
    return out;
  }

  /** Small helper to build the audit "meta" map: meta("a", 1, "b", "x"). Values may be null. */
  private static Map<String, Object> meta(Object... kv) {
    Map<String, Object> m = new LinkedHashMap<>();
    for (int i = 0; i + 1 < kv.length; i += 2) m.put(String.valueOf(kv[i]), kv[i + 1]);
    return m;
  }
}
