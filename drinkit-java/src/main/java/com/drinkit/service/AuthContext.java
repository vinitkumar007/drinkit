package com.drinkit.service;

import com.drinkit.common.HttpError;
import com.drinkit.config.AppConfig;
import com.drinkit.db.Db;
import com.drinkit.util.Jwt;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Arrays;
import java.util.Map;
import org.springframework.stereotype.Component;

/** Finds the logged-in user from the "Authorization: Bearer <token>" header. */
@Component
public class AuthContext {
  private final Db db;
  private final AppConfig cfg;

  public AuthContext(Db db, AppConfig cfg) {
    this.db = db;
    this.cfg = cfg;
  }

  /** Requires a valid token and returns the user row. */
  public Map<String, Object> user(HttpServletRequest req) {
    String h = req.getHeader("Authorization");
    String token = h != null && h.startsWith("Bearer ") ? h.substring(7) : null;
    if (token == null || token.isEmpty()) throw HttpError.unauthorized();
    long id;
    try {
      id = Jwt.verify(token, cfg.jwtSecret);
    } catch (IllegalArgumentException e) {
      throw HttpError.unauthorized("Invalid or expired token");
    }
    Map<String, Object> user = db.one("SELECT * FROM users WHERE id = ?", id);
    if (user == null) throw HttpError.unauthorized("User not found");
    return user;
  }

  /** Same as user() but also checks the role, e.g. requireRole(req, "admin"). */
  public Map<String, Object> requireRole(HttpServletRequest req, String... roles) {
    Map<String, Object> user = user(req);
    if (!Arrays.asList(roles).contains(String.valueOf(user.get("role")))) throw HttpError.forbidden();
    return user;
  }
}
