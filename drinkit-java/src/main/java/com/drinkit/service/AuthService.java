package com.drinkit.service;

import com.drinkit.common.HttpError;
import com.drinkit.common.M;
import com.drinkit.common.Validate;
import com.drinkit.config.AppConfig;
import com.drinkit.db.Db;
import com.drinkit.util.AgeRules;
import com.drinkit.util.Dates;
import com.drinkit.util.Jwt;
import com.drinkit.util.Passwords;
import java.security.SecureRandom;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class AuthService {
  private static final Logger log = LoggerFactory.getLogger(AuthService.class);
  private static final SecureRandom RNG = new SecureRandom();

  private final Db db;
  private final AppConfig cfg;

  public AuthService(Db db, AppConfig cfg) {
    this.db = db;
    this.cfg = cfg;
  }

  public static Map<String, Object> publicUser(Map<String, Object> u) {
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("id", u.get("id"));
    out.put("phone", u.get("phone"));
    out.put("name", u.get("name"));
    out.put("role", u.get("role"));
    out.put("age_verified", M.i(u, "age_verified") != 0);
    return out;
  }

  // ---------- customer OTP login ----------
  public Map<String, Object> requestOtp(Object phoneRaw) {
    String phone = Validate.phone(phoneRaw);
    // Who may see the OTP in the response? Everyone in dev/test. In production only customers, and only in DEMO_OTP mode.
    Map<String, Object> existing = db.one("SELECT role FROM users WHERE phone = ?", phone);
    boolean isStaff = existing != null && !"customer".equals(M.s(existing, "role"));
    boolean expose = !cfg.prod || (cfg.demoOtp && !isStaff);

    String code = String.valueOf(100000 + RNG.nextInt(900000));
    long expires = System.currentTimeMillis() + AppConfig.OTP_TTL_MS;
    int changed = db.update("UPDATE otps SET code = ?, expires_at = ?, attempts = 0 WHERE phone = ?", code, expires, phone);
    if (changed == 0) db.update("INSERT INTO otps (phone, code, expires_at, attempts) VALUES (?,?,?,0)", phone, code, expires);
    // TODO(production): send the OTP by SMS (MSG91 / Twilio / Fast2SMS) here.
    if (expose) log.info("[DEV OTP] {}: {}", phone, code);

    Map<String, Object> out = new LinkedHashMap<>();
    out.put("ok", true);
    if (expose) out.put("dev_otp", code);
    return out;
  }

  public Map<String, Object> verifyOtp(Object phoneRaw, Object otpRaw, Object nameRaw) {
    String phone = Validate.phone(phoneRaw);
    String otp = otpRaw == null ? "" : String.valueOf(otpRaw);
    Map<String, Object> row = db.one("SELECT * FROM otps WHERE phone = ?", phone);
    if (row == null || M.l(row, "expires_at") < System.currentTimeMillis()) {
      throw HttpError.badRequest("OTP expire ho gaya, dubara bhejo");
    }
    if (M.i(row, "attempts") >= AppConfig.OTP_MAX_ATTEMPTS) {
      throw HttpError.tooMany("Bahut zyada galat attempts. Naya OTP lo.");
    }
    if (!M.s(row, "code").equals(otp)) {
      db.update("UPDATE otps SET attempts = attempts + 1 WHERE phone = ?", phone);
      throw HttpError.badRequest("Galat OTP");
    }
    db.update("DELETE FROM otps WHERE phone = ?", phone);

    Map<String, Object> user = db.one("SELECT * FROM users WHERE phone = ?", phone);
    if (user == null) {
      String name = Validate.optStr(nameRaw, "Value", 60);
      long id = db.insert("INSERT INTO users (phone, name, role, age_verified, created_at) VALUES (?,?,?,?,?)",
          phone, name, "customer", 0, Dates.nowUtc());
      user = db.one("SELECT * FROM users WHERE id = ?", id);
    }
    return session(user);
  }

  // ---------- staff (admin / rider) password login ----------
  public Map<String, Object> staffLogin(Object phoneRaw, Object passwordRaw) {
    String phone = Validate.phone(phoneRaw);
    String password = passwordRaw == null ? "" : String.valueOf(passwordRaw);
    Map<String, Object> user = db.one("SELECT * FROM users WHERE phone = ? AND role IN ('admin','rider')", phone);
    // Hash even for unknown numbers so response time does not reveal which numbers are staff.
    boolean ok = Passwords.verify(password, user != null ? M.s(user, "password_hash") : Passwords.dummyHash());
    if (user == null || !ok) throw HttpError.unauthorized("Number ya password galat hai");
    return session(user);
  }

  /** STAFF_PASSWORD in the environment is the source of truth for all admin/rider passwords. */
  public int applyStaffPasswordFromEnv() {
    String pw = cfg.staffPassword;
    if (pw == null || pw.isEmpty()) return 0;
    if (pw.length() < 8) {
      log.warn("STAFF_PASSWORD ignored: it must be at least 8 characters.");
      return 0;
    }
    int applied = 0;
    List<Map<String, Object>> staff = db.list("SELECT id, password_hash FROM users WHERE role IN ('admin','rider')");
    for (Map<String, Object> u : staff) {
      if (!Passwords.verify(pw, M.s(u, "password_hash"))) {
        db.update("UPDATE users SET password_hash = ? WHERE id = ?", Passwords.hash(pw), u.get("id"));
        applied++;
      }
    }
    return applied;
  }

  // ---------- profile / age ----------
  /** Self-declared DOB. The rider ALSO checks physical ID at the doorstep. For production add a KYC provider. */
  public void setAge(Map<String, Object> user, Object dob, String state) {
    Map<String, Object> rule = db.one("SELECT * FROM state_rules WHERE state = ?", state);
    if (rule == null) throw HttpError.badRequest("State supported nahi hai");
    AgeRules.assertLegalAge(dob, state, M.i(rule, "min_age"));
    db.update("UPDATE users SET dob = ?, age_verified = 1 WHERE id = ?", dob, user.get("id"));
  }

  public Map<String, Object> updateProfile(Map<String, Object> user, Object nameRaw) {
    String name = Validate.str(nameRaw, "Naam", 1, 60);
    db.update("UPDATE users SET name = ? WHERE id = ?", name, user.get("id"));
    Map<String, Object> copy = new LinkedHashMap<>(user);
    copy.put("name", name);
    return publicUser(copy);
  }

  private Map<String, Object> session(Map<String, Object> user) {
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("token", Jwt.sign(M.l(user, "id"), cfg.jwtSecret, AppConfig.JWT_TTL_SECONDS));
    out.put("user", publicUser(user));
    return out;
  }
}
