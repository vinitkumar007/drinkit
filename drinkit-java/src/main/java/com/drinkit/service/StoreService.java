package com.drinkit.service;

import com.drinkit.common.M;
import com.drinkit.config.AppConfig;
import com.drinkit.db.Db;
import com.drinkit.util.Dates;
import com.drinkit.util.Geo;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

@Service
public class StoreService {
  /** Result of "can we deliver here?". store/etaMinutes are set only when relevant. */
  public record Serviceability(boolean ok, String reason, Map<String, Object> store, Integer etaMinutes) {}

  private final Db db;
  private final AppConfig cfg;

  public StoreService(Db db, AppConfig cfg) {
    this.db = db;
    this.cfg = cfg;
  }

  /** Finds the nearest active store covering the location and checks delivery rules. */
  public Serviceability findServiceableStore(double lat, double lng) {
    List<Map<String, Object>> stores = db.list(
        "SELECT s.*, r.min_age, r.delivery_allowed FROM stores s JOIN state_rules r ON r.state = s.state WHERE s.active = 1");

    Map<String, Object> best = null;
    double bestDist = 0;
    for (Map<String, Object> s : stores) {
      double dist = Geo.haversineKm(lat, lng, M.d(s, "lat"), M.d(s, "lng"));
      if (dist > M.d(s, "radius_km")) continue;
      if (best == null || dist < bestDist) {
        best = s;
        bestDist = dist;
      }
    }
    if (best == null) return new Serviceability(false, "Aapke area me abhi delivery available nahi hai.", null, null);
    if (M.i(best, "delivery_allowed") == 0) {
      return new Serviceability(false, M.s(best, "state") + " me home delivery allowed nahi hai.", null, null);
    }

    int hour = Dates.istHour();
    int open = M.i(best, "open_hour");
    int close = M.i(best, "close_hour");
    if (!cfg.ignoreStoreHours && (hour < open || hour >= close)) {
      return new Serviceability(false, "Store " + open + ":00 se " + close + ":00 tak open hai.", best, null);
    }
    int eta = (int) Math.max(8, Math.round(6 + bestDist * 3));
    return new Serviceability(true, null, best, eta);
  }

  /** What the apps may see about a store. */
  public static Map<String, Object> publicStore(Map<String, Object> s) {
    if (s == null) return null;
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("id", s.get("id"));
    out.put("name", s.get("name"));
    out.put("state", s.get("state"));
    out.put("min_age", s.get("min_age"));
    return out;
  }
}
