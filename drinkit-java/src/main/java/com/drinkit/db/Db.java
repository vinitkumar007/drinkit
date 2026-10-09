package com.drinkit.db;

import java.sql.PreparedStatement;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Supplier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * The only class that talks to the database driver. Services write plain SQL and get rows back as
 * Maps (column name -> value), so the JSON sent to the web apps is exactly the table columns.
 */
@Component
public class Db {
  private final JdbcTemplate jdbc;
  private final TransactionTemplate tx;

  public Db(JdbcTemplate jdbc, PlatformTransactionManager tm) {
    this.jdbc = jdbc;
    this.tx = new TransactionTemplate(tm);
  }

  public List<Map<String, Object>> list(String sql, Object... args) {
    List<Map<String, Object>> rows = jdbc.queryForList(sql, args);
    List<Map<String, Object>> out = new ArrayList<>(rows.size());
    for (Map<String, Object> r : rows) {
      Map<String, Object> m = new LinkedHashMap<>();
      r.forEach((k, v) -> m.put(k.toLowerCase(Locale.ROOT), v));
      out.add(m);
    }
    return out;
  }

  /** First row, or null if there is none. */
  public Map<String, Object> one(String sql, Object... args) {
    List<Map<String, Object>> rows = list(sql, args);
    return rows.isEmpty() ? null : rows.get(0);
  }

  /** Runs INSERT/UPDATE/DELETE and returns the number of rows changed. */
  public int update(String sql, Object... args) {
    return jdbc.update(sql, args);
  }

  /** Runs an INSERT into a table with an "id" column and returns the new id. */
  public long insert(String sql, Object... args) {
    KeyHolder keys = new GeneratedKeyHolder();
    jdbc.update(con -> {
      PreparedStatement ps = con.prepareStatement(sql, new String[] { "id" });
      for (int i = 0; i < args.length; i++) ps.setObject(i + 1, args[i]);
      return ps;
    }, keys);
    Number key = keys.getKey();
    if (key == null) throw new IllegalStateException("Insert did not return an id");
    return key.longValue();
  }

  /** All-or-nothing block. Any exception rolls everything back (used for orders, so stock never goes wrong). */
  public <T> T tx(Supplier<T> work) {
    return tx.execute(status -> work.get());
  }

  public void txRun(Runnable work) {
    tx.executeWithoutResult(status -> work.run());
  }
}
