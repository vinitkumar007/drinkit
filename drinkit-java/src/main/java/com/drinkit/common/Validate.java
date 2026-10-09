package com.drinkit.common;

import java.util.List;
import java.util.regex.Pattern;

/** Small input validators. All throw 400 HttpErrors with user-friendly (Hinglish) messages. */
public final class Validate {
  private Validate() {}

  private static final Pattern NUMBER = Pattern.compile("^[+-]?(\\d+(\\.\\d*)?|\\.\\d+)([eE][+-]?\\d+)?$");
  private static final Pattern PHONE = Pattern.compile("^[6-9]\\d{9}$");

  /** Like JavaScript Number(): numbers, numeric strings and booleans work. Anything else is NaN. */
  public static double toNumber(Object v) {
    if (v instanceof Number n) return n.doubleValue();
    if (v instanceof Boolean b) return b ? 1 : 0;
    if (v instanceof String s) {
      String t = s.trim();
      if (t.isEmpty()) return 0;
      if (!NUMBER.matcher(t).matches()) return Double.NaN;
      try { return Double.parseDouble(t); } catch (NumberFormatException e) { return Double.NaN; }
    }
    return Double.NaN;
  }

  /** JavaScript-style truthiness for values coming from JSON. */
  public static boolean truthy(Object v) {
    if (v == null) return false;
    if (v instanceof Boolean b) return b;
    if (v instanceof Number n) return n.doubleValue() != 0;
    if (v instanceof String s) return !s.isEmpty();
    return true;
  }

  public static String str(Object v, String name, int min, int max) {
    String s = v instanceof String x ? x.trim() : "";
    if (s.length() < min) throw HttpError.badRequest(name + " zaroori hai");
    if (s.length() > max) throw HttpError.badRequest(name + " bahut lamba hai");
    return s;
  }

  /** Optional text: null or "" gives null. */
  public static String optStr(Object v, String name, int max) {
    if (v == null || "".equals(v)) return null;
    return str(v, name, 0, max);
  }

  public static int integer(Object v, String name, long min, long max) {
    double n = toNumber(v);
    if (Double.isNaN(n) || Double.isInfinite(n) || n != Math.rint(n) || n < min || n > max) {
      throw HttpError.badRequest(name + " " + min + " se " + max + " ke beech integer hona chahiye");
    }
    return (int) n;
  }

  public static double num(Object v, String name, double min, double max) {
    double n = v == null || "".equals(v) ? Double.NaN : toNumber(v);
    if (Double.isNaN(n) || Double.isInfinite(n) || n < min || n > max) {
      throw HttpError.badRequest(name + " sahi number hona chahiye");
    }
    return n;
  }

  public static String phone(Object v) {
    String digits = String.valueOf(v == null ? "" : v).replaceAll("\\D", "");
    String p = digits.length() > 10 ? digits.substring(digits.length() - 10) : digits;
    if (!PHONE.matcher(p).matches()) throw HttpError.badRequest("Valid 10 digit mobile number daalo");
    return p;
  }

  public static String oneOf(Object v, List<String> list, String name) {
    if (!(v instanceof String s) || !list.contains(s)) {
      throw HttpError.badRequest(name + " in me se hona chahiye: " + String.join(", ", list));
    }
    return s;
  }

  public static double lat(Object v) { return num(v, "Latitude", -90, 90); }
  public static double lng(Object v) { return num(v, "Longitude", -180, 180); }
}
