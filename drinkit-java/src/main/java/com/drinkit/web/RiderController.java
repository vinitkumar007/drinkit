package com.drinkit.web;

import com.drinkit.common.Validate;
import com.drinkit.service.AuthContext;
import com.drinkit.service.OrderService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Everything under /api/rider needs a rider login. */
@RestController
@RequestMapping("/api/rider")
public class RiderController {
  private final OrderService orders;
  private final AuthContext ctx;

  public RiderController(OrderService orders, AuthContext ctx) {
    this.orders = orders;
    this.ctx = ctx;
  }

  private Map<String, Object> guard(HttpServletRequest req) {
    return ctx.requireRole(req, "rider");
  }

  @GetMapping("/me")
  public Map<String, Object> me(HttpServletRequest req) {
    return orders.riderProfile(guard(req));
  }

  @PatchMapping("/availability")
  public Map<String, Object> availability(HttpServletRequest req, @RequestBody(required = false) Map<String, Object> body) {
    Map<String, Object> user = guard(req);
    orders.riderSetAvailability(user, Validate.truthy(Req.body(body).get("available")));
    return AuthController.ok();
  }

  @GetMapping("/orders")
  public List<Map<String, Object>> jobs(HttpServletRequest req) {
    return orders.riderJobs(guard(req));
  }

  @PostMapping("/orders/{id}/pickup")
  public Map<String, Object> pickup(HttpServletRequest req, @PathVariable("id") String id) {
    Map<String, Object> user = guard(req);
    orders.riderPickup(user, Req.id(id, "Order"));
    return AuthController.ok();
  }

  @PostMapping("/orders/{id}/deliver")
  public Map<String, Object> deliver(HttpServletRequest req, @PathVariable("id") String id,
      @RequestBody(required = false) Map<String, Object> body) {
    Map<String, Object> user = guard(req);
    orders.riderDeliver(user, Req.id(id, "Order"), Req.body(body));
    return AuthController.ok();
  }

  @PostMapping("/orders/{id}/refuse")
  public Map<String, Object> refuse(HttpServletRequest req, @PathVariable("id") String id,
      @RequestBody(required = false) Map<String, Object> body) {
    Map<String, Object> user = guard(req);
    orders.riderRefuse(user, Req.id(id, "Order"), Req.body(body).get("reason"));
    return AuthController.ok();
  }
}
