package com.drinkit.service;

import com.drinkit.db.Db;
import com.drinkit.util.Dates;
import com.drinkit.util.Json;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/** Append-only record of sensitive actions. Safe to call inside a transaction. */
@Service
public class AuditService {
  private final Db db;

  public AuditService(Db db) { this.db = db; }

  public void log(Long userId, String action, String entity, Object entityId, Map<String, Object> meta) {
    db.update("INSERT INTO audit_log (user_id, action, entity, entity_id, meta, created_at) VALUES (?,?,?,?,?,?)",
        userId, action, entity, entityId == null ? null : String.valueOf(entityId),
        meta == null ? null : Json.write(meta), Dates.nowUtc());
  }

  public List<Map<String, Object>> recent(int limit) {
    return db.list("SELECT a.*, u.name AS user_name FROM audit_log a LEFT JOIN users u ON u.id = a.user_id "
        + "ORDER BY a.id DESC LIMIT ?", limit);
  }
}
