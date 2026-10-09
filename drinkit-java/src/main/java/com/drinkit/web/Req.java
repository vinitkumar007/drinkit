package com.drinkit.web;

import com.drinkit.common.Validate;
import java.util.Map;

/** Small helpers for controllers. */
final class Req {
  private Req() {}

  /** A missing JSON body behaves like {}. */
  static Map<String, Object> body(Map<String, Object> body) {
    return body == null ? Map.of() : body;
  }

  /** Path id such as /orders/12 -> 12, or a 400 error. */
  static long id(String raw, String name) {
    return Validate.integer(raw, name, 1, 1_000_000_000L);
  }
}
