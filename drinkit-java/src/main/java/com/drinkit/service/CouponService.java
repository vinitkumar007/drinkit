package com.drinkit.service;

import com.drinkit.common.HttpError;
import com.drinkit.common.M;
import com.drinkit.db.Db;
import com.drinkit.util.CouponMath;
import com.drinkit.util.Dates;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Service;

@Service
public class CouponService {
  private final Db db;

  public CouponService(Db db) { this.db = db; }

  /** Returns {code, discount} for a valid coupon, or throws a 400 explaining why not. */
  public Map<String, Object> quote(Object codeRaw, int subtotal) {
    String code = codeRaw == null ? "" : String.valueOf(codeRaw).trim().toUpperCase(Locale.ROOT);
    Map<String, Object> c = db.one("SELECT * FROM coupons WHERE code = ?", code);
    if (c == null || M.i(c, "active") == 0) throw HttpError.badRequest("Ye coupon valid nahi hai");

    String exp = M.s(c, "expires_at");
    if (exp != null && !exp.isEmpty()) {
      Instant e = Dates.parse(exp);
      if (e != null && e.isBefore(Instant.now())) throw HttpError.badRequest("Ye coupon expire ho gaya");
    }
    int min = M.i(c, "min_subtotal");
    if (subtotal < min) throw HttpError.badRequest("Is coupon ke liye minimum ₹" + min + " ka order chahiye");

    Integer max = c.get("max_discount") == null ? null : M.i(c, "max_discount");
    int discount = CouponMath.discount(M.s(c, "type"), M.i(c, "value"), max, subtotal);

    Map<String, Object> out = new LinkedHashMap<>();
    out.put("code", c.get("code"));
    out.put("discount", discount);
    return out;
  }
}
