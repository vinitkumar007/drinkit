package com.drinkit.web;

import com.drinkit.common.M;
import com.drinkit.service.AddressService;
import com.drinkit.service.AuthContext;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/addresses")
public class AddressController {
  private final AddressService addresses;
  private final AuthContext ctx;

  public AddressController(AddressService addresses, AuthContext ctx) {
    this.addresses = addresses;
    this.ctx = ctx;
  }

  @GetMapping
  public List<Map<String, Object>> list(HttpServletRequest req) {
    return addresses.list(M.l(ctx.user(req), "id"));
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public Map<String, Object> create(HttpServletRequest req, @RequestBody(required = false) Map<String, Object> body) {
    return addresses.create(M.l(ctx.user(req), "id"), Req.body(body));
  }

  @DeleteMapping("/{id}")
  public Map<String, Object> remove(HttpServletRequest req, @PathVariable("id") String id) {
    Map<String, Object> user = ctx.user(req);
    addresses.remove(M.l(user, "id"), Req.id(id, "Address"));
    return AuthController.ok();
  }
}
