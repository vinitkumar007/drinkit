package com.drinkit.util;

import java.security.MessageDigest;
import java.security.SecureRandom;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;

/** Password hashing with PBKDF2 (built into Java). Stored as pbkdf2$iterations$saltHex$hashHex. */
public final class Passwords {
  private Passwords() {}

  private static final int ITERATIONS = 120_000;
  private static final SecureRandom RNG = new SecureRandom();
  private static volatile String dummy;

  public static String hash(String password) {
    byte[] salt = new byte[16];
    RNG.nextBytes(salt);
    return "pbkdf2$" + ITERATIONS + "$" + hex(salt) + "$" + hex(derive(password, salt, ITERATIONS));
  }

  public static boolean verify(String password, String stored) {
    if (stored == null) return false;
    String[] p = stored.split("\\$");
    if (p.length != 4 || !"pbkdf2".equals(p[0])) return false;
    try {
      int iter = Integer.parseInt(p[1]);
      byte[] expected = unhex(p[3]);
      return MessageDigest.isEqual(derive(password, unhex(p[2]), iter), expected);
    } catch (RuntimeException e) {
      return false;
    }
  }

  /** A real hash of a throwaway password, used to burn the same time for unknown phone numbers. */
  public static String dummyHash() {
    if (dummy == null) dummy = hash("not-a-real-password");
    return dummy;
  }

  private static byte[] derive(String password, byte[] salt, int iterations) {
    try {
      PBEKeySpec spec = new PBEKeySpec(password.toCharArray(), salt, iterations, 256);
      return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded();
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }

  private static String hex(byte[] b) {
    StringBuilder sb = new StringBuilder();
    for (byte x : b) sb.append(String.format("%02x", x));
    return sb.toString();
  }

  private static byte[] unhex(String s) {
    byte[] out = new byte[s.length() / 2];
    for (int i = 0; i < out.length; i++) out[i] = (byte) Integer.parseInt(s.substring(2 * i, 2 * i + 2), 16);
    return out;
  }
}
