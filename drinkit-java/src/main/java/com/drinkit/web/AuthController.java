package com.drinkit.web;

import com.drinkit.common.Validate;
import com.drinkit.config.AppConfig;
import com.drinkit.service.AuthContext;
import com.drinkit.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class AuthController {
  private final AuthService auth;
  private final AuthContext ctx;
  private final RateLimiter authLimiter;
  private final RateLimiter staffLimiter;

  public AuthController(AuthService auth, AuthContext ctx, AppConfig cfg) {
    this.auth = auth;
    this.ctx = ctx;
    this.authLimiter = new RateLimiter(cfg.authRateMax, AppConfig.RATE_WINDOW_MS);
    this.staffLimiter = new RateLimiter(cfg.staffRateMax, AppConfig.RATE_WINDOW_MS);
  }

  /** Admin / rider login with phone + password (no SMS needed). */
  @PostMapping("/auth/staff-login")
  public Map<String, Object> staffLogin(HttpServletRequest req, @RequestBody(required = false) Map<String, Object> body) {
    staffLimiter.check(req.getRemoteAddr());
    Map<String, Object> b = Req.body(body);
    return auth.staffLogin(b.get("phone"), b.get("password"));
  }

  @PostMapping("/auth/request-otp")
  public Map<String, Object> requestOtp(HttpServletRequest req, @RequestBody(required = false) Map<String, Object> body) {
    authLimiter.check(req.getRemoteAddr());
    return auth.requestOtp(Req.body(body).get("phone"));
  }

  @PostMapping("/auth/verify-otp")
  public Map<String, Object> verifyOtp(HttpServletRequest req, @RequestBody(required = false) Map<String, Object> body) {
    authLimiter.check(req.getRemoteAddr());
    Map<String, Object> b = Req.body(body);
    return auth.verifyOtp(b.get("phone"), b.get("otp"), b.get("name"));
  }

  @GetMapping("/me")
  public Map<String, Object> me(HttpServletRequest req) {
    return userEnvelope(AuthService.publicUser(ctx.user(req)));
  }

  @PatchMapping("/me")
  public Map<String, Object> updateMe(HttpServletRequest req, @RequestBody(required = false) Map<String, Object> body) {
    return userEnvelope(auth.updateProfile(ctx.user(req), Req.body(body).get("name")));
  }

  /** Age gate (self-declared DOB; rider also checks physical ID at the doorstep). */
  @PostMapping("/auth/age")
  public Map<String, Object> age(HttpServletRequest req, @RequestBody(required = false) Map<String, Object> body) {
    Map<String, Object> user = ctx.user(req);
    Map<String, Object> b = Req.body(body);
    auth.setAge(user, b.get("dob"), Validate.str(b.get("state"), "State", 1, 40));
    return ok();
  }

  static Map<String, Object> ok() {
    Map<String, Object> m = new LinkedHashMap<>();
    m.put("ok", true);
    return m;
  }

  private static Map<String, Object> userEnvelope(Map<String, Object> user) {
    Map<String, Object> m = new LinkedHashMap<>();
    m.put("user", user);
    return m;
  }
}
