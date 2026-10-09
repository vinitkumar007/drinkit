package com.drinkit.util;

import com.drinkit.common.HttpError;
import java.time.LocalDate;
import java.time.Period;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.regex.Pattern;

public final class AgeRules {
  private AgeRules() {}

  private static final Pattern ISO_DATE = Pattern.compile("^\\d{4}-\\d{2}-\\d{2}$");
  private static final ZoneId IST = ZoneId.of("Asia/Kolkata");

  public static Integer ageFromDob(Object dob) { return ageFromDob(dob, LocalDate.now(IST)); }

  /** Age in whole years, or null when the date is missing, invalid or in the future. */
  public static Integer ageFromDob(Object dob, LocalDate today) {
    if (!(dob instanceof String s) || !ISO_DATE.matcher(s).matches()) return null;
    LocalDate d;
    try { d = LocalDate.parse(s); } catch (DateTimeParseException e) { return null; }
    if (d.isAfter(today)) return null;
    return Period.between(d, today).getYears();
  }

  /** Throws 400/403 if the date of birth is invalid or below the state's minimum age. */
  public static int assertLegalAge(Object dob, String state, int minAge) {
    Integer age = ageFromDob(dob);
    if (age == null) throw HttpError.badRequest("Valid date of birth daalo (YYYY-MM-DD)");
    if (age < minAge) throw HttpError.forbidden(state + " me alcohol kharidne ki minimum umar " + minAge + " saal hai.");
    return age;
  }
}
