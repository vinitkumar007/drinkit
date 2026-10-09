package com.drinkit.service;

import com.drinkit.common.HttpError;
import com.drinkit.common.Validate;
import com.drinkit.db.Db;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

@Service
public class CatalogService {
  private final Db db;

  public CatalogService(Db db) { this.db = db; }

  public List<Map<String, Object>> categories() {
    return db.list("SELECT * FROM categories ORDER BY id");
  }

  public List<Map<String, Object>> productsForStore(long storeId, String category, String q) {
    if (storeId <= 0) throw HttpError.badRequest("store_id chahiye (pehle serviceability check karo)");
    List<Object> params = new ArrayList<>();
    params.add(storeId);
    StringBuilder sql = new StringBuilder(
        "SELECT p.id, p.name, p.brand, p.size_ml, p.abv, p.price, p.category_id, c.name AS category, i.stock "
        + "FROM products p JOIN categories c ON c.id = p.category_id "
        + "JOIN inventory i ON i.product_id = p.id AND i.store_id = ? "
        + "WHERE p.active = 1");
    if (category != null && !category.isEmpty()) {
      double c = Validate.toNumber(category);
      sql.append(" AND p.category_id = ?");
      params.add(Double.isNaN(c) ? -1 : (long) c);
    }
    if (q != null && !q.isEmpty()) {
      String like = "%" + (q.length() > 50 ? q.substring(0, 50) : q).toLowerCase() + "%";
      sql.append(" AND (LOWER(p.name) LIKE ? OR LOWER(p.brand) LIKE ?)");
      params.add(like);
      params.add(like);
    }
    sql.append(" ORDER BY p.category_id, p.name");
    return db.list(sql.toString(), params.toArray());
  }
}
