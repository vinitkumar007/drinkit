package com.drinkit.common;

import java.util.Map;

/** Tiny helpers for reading values out of database rows (Map). */
public final class M {
  private M() {}

  public static int i(Map<String, Object> m, String k) {
    Object o = m.get(k);
    return o == null ? 0 : ((Number) o).intValue();
  }

  public static long l(Map<String, Object> m, String k) {
    Object o = m.get(k);
    return o == null ? 0L : ((Number) o).longValue();
  }

  public static double d(Map<String, Object> m, String k) {
    Object o = m.get(k);
    return o == null ? 0d : ((Number) o).doubleValue();
  }

  public static String s(Map<String, Object> m, String k) {
    Object o = m.get(k);
    return o == null ? null : o.toString();
  }
}
