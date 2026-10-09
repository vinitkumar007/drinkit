package com.drinkit.db;

import com.drinkit.service.AuthService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/** Runs once at startup: demo data (only if the database is empty) and the STAFF_PASSWORD. */
@Component
public class Bootstrap implements ApplicationRunner {
  private static final Logger log = LoggerFactory.getLogger(Bootstrap.class);

  private final Seeder seeder;
  private final AuthService auth;

  public Bootstrap(Seeder seeder, AuthService auth) {
    this.seeder = seeder;
    this.auth = auth;
  }

  @Override
  public void run(ApplicationArguments args) {
    if (seeder.seed()) log.info("Seeded demo data.");
    int applied = auth.applyStaffPasswordFromEnv();
    if (applied > 0) log.info("STAFF_PASSWORD applied to {} admin/rider account(s).", applied);
  }
}
