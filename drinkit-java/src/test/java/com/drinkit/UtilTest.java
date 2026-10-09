package com.drinkit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.drinkit.common.HttpError;
import com.drinkit.common.Validate;
import com.drinkit.util.AgeRules;
import com.drinkit.util.CouponMath;
import com.drinkit.util.Geo;
import com.drinkit.util.Jwt;
import com.drinkit.util.Passwords;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

/** Plain unit tests: no Spring, no database. */
class UtilTest {
  @Test
  void phoneKeepsLastTenDigits() {
    assertEquals("9812345678", Validate.phone("+91 98123-45678"));
    assertEquals(400, assertThrows(HttpError.class, () -> Validate.phone("12345")).getStatus());
    assertThrows(HttpError.class, () -> Validate.phone("5812345678")); // must start with 6-9
  }

  @Test
  void integerBehavesLikeJavaScriptNumber() {
    assertEquals(5, Validate.integer("5", "Qty", 1, 10));
    assertEquals(5, Validate.integer(5.0, "Qty", 1, 10));
    assertThrows(HttpError.class, () -> Validate.integer(0, "Qty", 1, 10));
    assertThrows(HttpError.class, () -> Validate.integer(11, "Qty", 1, 10));
    assertThrows(HttpError.class, () -> Validate.integer(2.5, "Qty", 1, 10));
    assertThrows(HttpError.class, () -> Validate.integer("abc", "Qty", 1, 10));
    assertThrows(HttpError.class, () -> Validate.integer(null, "Qty", 1, 10));
    assertThrows(HttpError.class, () -> Validate.integer("5d", "Qty", 1, 10));
  }

  @Test
  void textValidators() {
    assertEquals("hello", Validate.str("  hello ", "Naam", 1, 10));
    assertThrows(HttpError.class, () -> Validate.str("", "Naam", 1, 10));
    assertThrows(HttpError.class, () -> Validate.str("12345678901", "Naam", 1, 10));
    assertNull(Validate.optStr("", "Reason", 10));
    assertNull(Validate.optStr(null, "Reason", 10));
    assertEquals("flat", Validate.oneOf("flat", java.util.List.of("flat", "percent"), "Type"));
    assertThrows(HttpError.class, () -> Validate.oneOf("other", java.util.List.of("flat", "percent"), "Type"));
    assertThrows(HttpError.class, () -> Validate.lat(91));
    assertThrows(HttpError.class, () -> Validate.lng("x"));
  }

  @Test
  void ageRules() {
    LocalDate today = LocalDate.of(2026, 10, 9);
    assertEquals(30, AgeRules.ageFromDob("1996-10-09", today));
    assertEquals(29, AgeRules.ageFromDob("1996-10-10", today)); // birthday tomorrow
    assertNull(AgeRules.ageFromDob("2030-01-01", today)); // future
    assertNull(AgeRules.ageFromDob("not-a-date", today));
    assertNull(AgeRules.ageFromDob("2020-02-31", today));
    String twenty = LocalDate.now().minusYears(20).toString();
    assertEquals(403, assertThrows(HttpError.class, () -> AgeRules.assertLegalAge(twenty, "Delhi", 25)).getStatus());
    assertEquals(400, assertThrows(HttpError.class, () -> AgeRules.assertLegalAge("bad", "Delhi", 25)).getStatus());
  }

  @Test
  void couponMath() {
    assertEquals(100, CouponMath.discount("flat", 100, null, 1000));
    assertEquals(150, CouponMath.discount("percent", 10, 150, 5000)); // capped
    assertEquals(50, CouponMath.discount("percent", 10, 150, 500));
    assertEquals(80, CouponMath.discount("flat", 100, null, 80)); // never more than the subtotal
  }

  @Test
  void jwtRoundTripAndTampering() {
    String token = Jwt.sign(42, "secret", 60);
    assertEquals(42L, Jwt.verify(token, "secret"));
    assertThrows(IllegalArgumentException.class, () -> Jwt.verify(token, "other-secret"));
    assertThrows(IllegalArgumentException.class, () -> Jwt.verify(token + "x", "secret"));
    assertThrows(IllegalArgumentException.class, () -> Jwt.verify("a.b", "secret"));
    String expired = Jwt.sign(42, "secret", -10);
    assertThrows(IllegalArgumentException.class, () -> Jwt.verify(expired, "secret"));
  }

  @Test
  void passwordHashing() {
    String h = Passwords.hash("Drinkit@2026");
    assertTrue(Passwords.verify("Drinkit@2026", h));
    assertFalse(Passwords.verify("drinkit@2026", h));
    assertFalse(Passwords.verify("anything", null));
    assertNotEquals(h, Passwords.hash("Drinkit@2026")); // random salt
  }

  @Test
  void distance() {
    double d = Geo.haversineKm(28.6315, 77.2167, 28.5245, 77.2066); // CP -> Saket, about 12 km
    assertTrue(d > 11 && d < 13, "distance was " + d);
    assertEquals(0.0, Geo.haversineKm(1, 1, 1, 1), 1e-9);
  }
}
