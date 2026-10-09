package com.drinkit.service;

import com.drinkit.common.HttpError;
import com.drinkit.common.Validate;
import com.drinkit.db.Db;
import com.drinkit.util.Dates;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

@Service
public class AddressService {
  private static final int MAX_PER_USER = 10;
  private static final String COLS = "id, label, address, lat, lng";

  private final Db db;

  public AddressService(Db db) { this.db = db; }

  public List<Map<String, Object>> list(long userId) {
    return db.list("SELECT " + COLS + " FROM addresses WHERE user_id = ? ORDER BY id DESC", userId);
  }

  /** One saved address of this user, or null. */
  public Map<String, Object> get(long userId, long id) {
    return db.one("SELECT " + COLS + " FROM addresses WHERE id = ? AND user_id = ?", id, userId);
  }

  public Map<String, Object> create(long userId, Map<String, Object> body) {
    if (list(userId).size() >= MAX_PER_USER) {
      throw HttpError.badRequest("Max " + MAX_PER_USER + " addresses save kar sakte ho");
    }
    Object rawLabel = Validate.truthy(body.get("label")) ? body.get("label") : "Home";
    String label = Validate.str(rawLabel, "Label", 1, 30);
    String address = Validate.str(body.get("address"), "Address", 8, 300);
    double lat = Validate.lat(body.get("lat"));
    double lng = Validate.lng(body.get("lng"));
    long id = db.insert("INSERT INTO addresses (user_id, label, address, lat, lng, created_at) VALUES (?,?,?,?,?,?)",
        userId, label, address, lat, lng, Dates.nowUtc());
    return get(userId, id);
  }

  public void remove(long userId, long id) {
    int n = db.update("DELETE FROM addresses WHERE id = ? AND user_id = ?", id, userId);
    if (n == 0) throw HttpError.notFound("Address nahi mila");
  }
}
