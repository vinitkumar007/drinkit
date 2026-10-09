package com.drinkit.web;

import com.drinkit.common.HttpError;
import java.util.concurrent.ConcurrentHashMap;

/** Allows at most `max` calls per key (client IP) in each time window. */
public class RateLimiter {
  private final int max;
  private final long windowMs;
  private final ConcurrentHashMap<String, long[]> hits = new ConcurrentHashMap<>(); // key -> {windowStart, count}

  public RateLimiter(int max, long windowMs) {
    this.max = max;
    this.windowMs = windowMs;
  }

  public void check(String key) {
    long now = System.currentTimeMillis();
    if (hits.size() > 10_000) hits.entrySet().removeIf(e -> now - e.getValue()[0] >= windowMs);
    long[] entry = hits.compute(key == null ? "x" : key, (k, v) -> {
      if (v == null || now - v[0] >= windowMs) return new long[] { now, 1 };
      v[1]++;
      return v;
    });
    if (entry[1] > max) throw HttpError.tooMany("Bahut zyada requests, thodi der baad try karo");
  }
}
