package com.drinkit.util;

public final class CouponMath {
  private CouponMath() {}

  /** Discount in rupees for a coupon. Never negative and never more than the subtotal. */
  public static int discount(String type, int value, Integer maxDiscount, int subtotal) {
    int d = "flat".equals(type) ? value : (int) (((long) subtotal * value) / 100);
    if (maxDiscount != null) d = Math.min(d, maxDiscount);
    return Math.max(0, Math.min(d, subtotal));
  }
}
