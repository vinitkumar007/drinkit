package com.drinkit.web;

import com.drinkit.service.AuthContext;
import com.drinkit.service.OrderService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/orders")
public class OrderController {
  private final OrderService orders;
  private final AuthContext ctx;

  public OrderController(OrderService orders, AuthContext ctx) {
    this.orders = orders;
    this.ctx = ctx;
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public Map<String, Object> place(HttpServletRequest req, @RequestBody(required = false) Map<String, Object> body) {
    return orders.placeOrder(ctx.user(req), Req.body(body));
  }

  @GetMapping
  public List<Map<String, Object>> list(HttpServletRequest req) {
    return orders.listForUser(ctx.user(req));
  }

  @GetMapping("/{id}")
  public Map<String, Object> get(HttpServletRequest req, @PathVariable("id") String id) {
    Map<String, Object> user = ctx.user(req);
    return orders.getForViewer(user, Req.id(id, "Order"));
  }

  @PostMapping("/{id}/cancel")
  public Map<String, Object> cancel(HttpServletRequest req, @PathVariable("id") String id) {
    Map<String, Object> user = ctx.user(req);
    return orders.cancelByCustomer(user, Req.id(id, "Order"));
  }
}
