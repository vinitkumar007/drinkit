package com.drinkit.web;

import com.drinkit.service.AdminService;
import com.drinkit.service.AuditService;
import com.drinkit.service.AuthContext;
import com.drinkit.service.OrderService;
import com.drinkit.common.Validate;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Everything under /api/admin needs an admin login. */
@RestController
@RequestMapping("/api/admin")
public class AdminController {
  private final AdminService admin;
  private final OrderService orders;
  private final AuditService audit;
  private final AuthContext ctx;

  public AdminController(AdminService admin, OrderService orders, AuditService audit, AuthContext ctx) {
    this.admin = admin;
    this.orders = orders;
    this.audit = audit;
    this.ctx = ctx;
  }

  private Map<String, Object> guard(HttpServletRequest req) {
    return ctx.requireRole(req, "admin");
  }

  @GetMapping("/stats")
  public Map<String, Object> stats(HttpServletRequest req) {
    guard(req);
    return admin.stats();
  }

  @GetMapping("/stores")
  public List<Map<String, Object>> stores(HttpServletRequest req) {
    guard(req);
    return admin.stores();
  }

  @GetMapping("/riders")
  public List<Map<String, Object>> riders(HttpServletRequest req) {
    guard(req);
    return admin.riders();
  }

  @GetMapping("/audit")
  public List<Map<String, Object>> auditLog(HttpServletRequest req) {
    guard(req);
    return audit.recent(100);
  }

  // ----- orders -----
  @GetMapping("/orders")
  public List<Map<String, Object>> orderList(HttpServletRequest req, @RequestParam(name = "status", required = false) String status) {
    guard(req);
    return orders.adminList(status);
  }

  @PatchMapping("/orders/{id}/status")
  public Map<String, Object> setStatus(HttpServletRequest req, @PathVariable("id") String id,
      @RequestBody(required = false) Map<String, Object> body) {
    Map<String, Object> user = guard(req);
    return orders.adminSetStatus(user, Req.id(id, "Order"), Req.body(body).get("status"));
  }

  @PostMapping("/orders/{id}/assign")
  public Map<String, Object> assign(HttpServletRequest req, @PathVariable("id") String id,
      @RequestBody(required = false) Map<String, Object> body) {
    Map<String, Object> user = guard(req);
    return orders.adminAssignRider(user, Req.id(id, "Order"), Req.body(body).get("rider_id"));
  }

  // ----- inventory -----
  @GetMapping("/inventory")
  public List<Map<String, Object>> inventory(HttpServletRequest req, @RequestParam(name = "store_id", required = false) String storeId) {
    guard(req);
    return admin.inventory(storeId);
  }

  @PatchMapping("/inventory")
  public Map<String, Object> setStock(HttpServletRequest req, @RequestBody(required = false) Map<String, Object> body) {
    Map<String, Object> user = guard(req);
    admin.setStock(user, Req.body(body));
    return AuthController.ok();
  }

  // ----- products -----
  @GetMapping("/products")
  public List<Map<String, Object>> products(HttpServletRequest req) {
    guard(req);
    return admin.products();
  }

  @PostMapping("/products")
  @ResponseStatus(HttpStatus.CREATED)
  public Map<String, Object> createProduct(HttpServletRequest req, @RequestBody(required = false) Map<String, Object> body) {
    Map<String, Object> user = guard(req);
    return admin.createProduct(user, Req.body(body));
  }

  @PatchMapping("/products/{id}")
  public Map<String, Object> updateProduct(HttpServletRequest req, @PathVariable("id") String id,
      @RequestBody(required = false) Map<String, Object> body) {
    Map<String, Object> user = guard(req);
    admin.updateProduct(user, id, Req.body(body));
    return AuthController.ok();
  }

  // ----- coupons -----
  @GetMapping("/coupons")
  public List<Map<String, Object>> couponList(HttpServletRequest req) {
    guard(req);
    return admin.listCoupons();
  }

  @PostMapping("/coupons")
  @ResponseStatus(HttpStatus.CREATED)
  public Map<String, Object> createCoupon(HttpServletRequest req, @RequestBody(required = false) Map<String, Object> body) {
    Map<String, Object> user = guard(req);
    return admin.createCoupon(user, Req.body(body));
  }

  @PatchMapping("/coupons/{code}")
  public Map<String, Object> toggleCoupon(HttpServletRequest req, @PathVariable("code") String code,
      @RequestBody(required = false) Map<String, Object> body) {
    Map<String, Object> user = guard(req);
    admin.setCouponActive(user, code, Validate.truthy(Req.body(body).get("active")));
    return AuthController.ok();
  }
}
