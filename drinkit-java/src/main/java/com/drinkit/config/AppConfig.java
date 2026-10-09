package com.drinkit.config;

import java.security.SecureRandom;
import java.util.List;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.stereotype.Component;

/**
 * All settings in one place. Environment variables:
 *   APP_ENV=production (NODE_ENV=production also works)  JWT_SECRET  STAFF_PASSWORD  DEMO_OTP
 *   AUTH_RATE_MAX  STAFF_RATE_MAX  IGNORE_STORE_HOURS  DB_FILE  PORT
 */
@Component
public class AppConfig {
  // Fixed rules
  public static final long OTP_TTL_MS = 5 * 60 * 1000L;
  public static final int OTP_MAX_ATTEMPTS = 5;
  public static final long RATE_WINDOW_MS = 15 * 60 * 1000L;
  public static final long JWT_TTL_SECONDS = 30L * 24 * 3600;
  public static final int MAX_ITEMS_PER_ORDER = 12;
  public static final int FREE_DELIVERY_ABOVE = 1000;
  public static final int DELIVERY_FEE = 30;
  public static final int DELIVERY_OTP_MAX_ATTEMPTS = 5;
  public static final List<String> CANCELLABLE_STATUSES = List.of("placed", "accepted");

  // From the environment
  public final boolean prod;
  public final String jwtSecret;
  /** Show customer OTPs on screen even in production (demo mode, until an SMS provider is connected). */
  public final boolean demoOtp;
  /** One shared password for every admin/rider account (min 8 characters). */
  public final String staffPassword;
  public final int authRateMax;
  public final int staffRateMax;
  public final boolean ignoreStoreHours;

  public AppConfig(Environment env) {
    this.prod = "production".equalsIgnoreCase(env.getProperty("NODE_ENV", ""))
        || "production".equalsIgnoreCase(env.getProperty("APP_ENV", ""))
        || env.acceptsProfiles(Profiles.of("prod"));

    String secret = env.getProperty("JWT_SECRET", "");
    if (secret.isBlank()) {
      if (prod) throw new IllegalStateException("JWT_SECRET must be set when running in production");
      secret = randomHex(32);
    }
    this.jwtSecret = secret;

    this.demoOtp = !env.getProperty("DEMO_OTP", "").isEmpty();
    this.staffPassword = env.getProperty("STAFF_PASSWORD", "");
    this.authRateMax = intOr(env.getProperty("AUTH_RATE_MAX"), 30);
    this.staffRateMax = intOr(env.getProperty("STAFF_RATE_MAX"), 10);
    this.ignoreStoreHours = !env.getProperty("IGNORE_STORE_HOURS", "").isEmpty();
  }

  private static int intOr(String s, int fallback) {
    try {
      int n = Integer.parseInt(s == null ? "" : s.trim());
      return n > 0 ? n : fallback;
    } catch (NumberFormatException e) {
      return fallback;
    }
  }

  private static String randomHex(int bytes) {
    byte[] b = new byte[bytes];
    new SecureRandom().nextBytes(b);
    StringBuilder sb = new StringBuilder();
    for (byte x : b) sb.append(String.format("%02x", x));
    return sb.toString();
  }
}
