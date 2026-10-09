package com.drinkit.util;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/** Minimal HS256 JWT carrying only the user id and an expiry. No external library. */
public final class Jwt {
  private Jwt() {}

  private static final Base64.Encoder ENC = Base64.getUrlEncoder().withoutPadding();
  private static final Base64.Decoder DEC = Base64.getUrlDecoder();
  private static final String HEADER = "{\"alg\":\"HS256\",\"typ\":\"JWT\"}";
  private static final Pattern ID = Pattern.compile("\"id\":(\\d+)");
  private static final Pattern EXP = Pattern.compile("\"exp\":(\\d+)");

  public static String sign(long userId, String secret, long ttlSeconds) {
    long exp = System.currentTimeMillis() / 1000 + ttlSeconds;
    String body = "{\"id\":" + userId + ",\"exp\":" + exp + "}";
    String data = b64(HEADER) + "." + b64(body);
    return data + "." + ENC.encodeToString(hmac(data, secret));
  }

  /** Returns the user id, or throws IllegalArgumentException if the token is bad or expired. */
  public static long verify(String token, String secret) {
    String[] parts = String.valueOf(token).split("\\.", -1);
    if (parts.length != 3) throw new IllegalArgumentException("bad token");
    byte[] expected = hmac(parts[0] + "." + parts[1], secret);
    byte[] given;
    try { given = DEC.decode(parts[2]); } catch (IllegalArgumentException e) { throw new IllegalArgumentException("bad signature"); }
    if (!MessageDigest.isEqual(expected, given)) throw new IllegalArgumentException("bad signature");
    String body;
    try { body = new String(DEC.decode(parts[1]), StandardCharsets.UTF_8); } catch (IllegalArgumentException e) { throw new IllegalArgumentException("bad body"); }
    Matcher id = ID.matcher(body);
    Matcher exp = EXP.matcher(body);
    if (!id.find() || !exp.find()) throw new IllegalArgumentException("bad body");
    if (Long.parseLong(exp.group(1)) < System.currentTimeMillis() / 1000) throw new IllegalArgumentException("expired");
    return Long.parseLong(id.group(1));
  }

  private static String b64(String s) { return ENC.encodeToString(s.getBytes(StandardCharsets.UTF_8)); }

  private static byte[] hmac(String data, String secret) {
    try {
      Mac mac = Mac.getInstance("HmacSHA256");
      mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
      return mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }
}
