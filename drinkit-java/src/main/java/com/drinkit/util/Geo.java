package com.drinkit.util;

public final class Geo {
  private Geo() {}

  /** Distance in km between two lat/lng points (haversine formula). */
  public static double haversineKm(double lat1, double lng1, double lat2, double lng2) {
    double r = 6371;
    double dLat = Math.toRadians(lat2 - lat1);
    double dLng = Math.toRadians(lng2 - lng1);
    double a = Math.pow(Math.sin(dLat / 2), 2)
        + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) * Math.pow(Math.sin(dLng / 2), 2);
    return 2 * r * Math.asin(Math.sqrt(a));
  }
}
