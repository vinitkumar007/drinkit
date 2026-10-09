package com.drinkit.util;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.regex.Pattern;

public final class Dates {
  private Dates() {}

  private static final DateTimeFormatter DB = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
  private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
  private static final Pattern DATE_ONLY = Pattern.compile("^\\d{4}-\\d{2}-\\d{2}$");

  /** Current time as stored in the database: UTC, "yyyy-MM-dd HH:mm:ss". */
  public static String nowUtc() { return LocalDateTime.now(ZoneOffset.UTC).format(DB); }

  /** Start (inclusive) and end (exclusive) of today in India, as database timestamps in UTC. */
  public static String[] istTodayBoundsUtc() {
    LocalDate today = LocalDate.now(IST);
    return new String[] { dbUtc(today.atStartOfDay(IST).toInstant()), dbUtc(today.plusDays(1).atStartOfDay(IST).toInstant()) };
  }

  public static int istHour() { return java.time.ZonedDateTime.now(IST).getHour(); }

  private static String dbUtc(Instant i) { return LocalDateTime.ofInstant(i, ZoneOffset.UTC).format(DB); }

  /** Parses "2026-12-31", "2026-12-31T10:00:00" or full ISO timestamps. Returns null if it cannot. */
  public static Instant parse(String s) {
    if (s == null) return null;
    String t = s.trim();
    try {
      if (DATE_ONLY.matcher(t).matches()) return LocalDate.parse(t).atStartOfDay(ZoneOffset.UTC).toInstant();
      try { return Instant.parse(t); } catch (DateTimeParseException ignored) { /* try next format */ }
      try { return OffsetDateTime.parse(t).toInstant(); } catch (DateTimeParseException ignored) { /* try next format */ }
      return LocalDateTime.parse(t.replace(' ', 'T')).toInstant(ZoneOffset.UTC);
    } catch (DateTimeParseException e) {
      return null;
    }
  }
}
