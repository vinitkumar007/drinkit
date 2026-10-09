package com.drinkit.web;

import com.drinkit.common.HttpError;
import com.drinkit.common.Validate;
import com.drinkit.service.AuthContext;
import com.drinkit.service.CatalogService;
import com.drinkit.service.CouponService;
import com.drinkit.service.StoreService;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class CatalogController {
  private final StoreService stores;
  private final CatalogService catalog;
  private final CouponService coupons;
  private final AuthContext ctx;

  public CatalogController(StoreService stores, CatalogService catalog, CouponService coupons, AuthContext ctx) {
    this.stores = stores;
    this.catalog = catalog;
    this.coupons = coupons;
    this.ctx = ctx;
  }

  @GetMapping("/health")
  public Map<String, Object> health() {
    Map<String, Object> m = new LinkedHashMap<>();
    m.put("ok", true);
    m.put("time", Instant.now().toString());
    return m;
  }

  /** Can we deliver to this location? Returns the serving store and ETA. */
  @GetMapping("/serviceability")
  public Map<String, Object> serviceability(@RequestParam(name = "lat", required = false) String lat,
      @RequestParam(name = "lng", required = false) String lng) {
    StoreService.Serviceability r = stores.findServiceableStore(Validate.lat(lat), Validate.lng(lng));
    Map<String, Object> m = new LinkedHashMap<>();
    m.put("serviceable", r.ok());
    m.put("reason", r.reason());
    m.put("store", StoreService.publicStore(r.store()));
    m.put("eta_minutes", r.etaMinutes());
    return m;
  }

  @GetMapping("/categories")
  public List<Map<String, Object>> categories() {
    return catalog.categories();
  }

  @GetMapping("/products")
  public List<Map<String, Object>> products(@RequestParam(name = "store_id", required = false) String storeId,
      @RequestParam(name = "category", required = false) String category,
      @RequestParam(name = "q", required = false) String q) {
    double id = storeId == null ? Double.NaN : Validate.toNumber(storeId);
    return catalog.productsForStore(Double.isNaN(id) ? 0 : (long) id, category, q);
  }

  /** Preview a coupon against a cart subtotal. The real discount is recomputed when the order is placed. */
  @PostMapping("/coupons/validate")
  public Map<String, Object> validateCoupon(HttpServletRequest req, @RequestBody(required = false) Map<String, Object> body) {
    ctx.user(req);
    Map<String, Object> b = Req.body(body);
    int subtotal = Validate.integer(b.get("subtotal"), "Subtotal", 0, 10_000_000);
    if (!Validate.truthy(b.get("code"))) throw HttpError.badRequest("Coupon code daalo");
    return coupons.quote(b.get("code"), subtotal);
  }
}
