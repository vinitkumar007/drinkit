# Architecture (Java / Spring Boot)

```
Browser (customer / admin / rider web apps, plain HTML + JS in src/main/resources/static)
        |  JSON over HTTP  (/api/...)
Spring Boot
  web/      Controllers (thin: read request, call a service, return JSON), error handler, security headers, rate limiter
  service/  Business rules: AuthService, OrderService, AdminService, StoreService, CatalogService, CouponService, AddressService, AuditService
  db/       Db (SQL helper + transactions), Seeder (demo data), Bootstrap (runs at startup)
  util/     Jwt, Passwords (PBKDF2), AgeRules, CouponMath, Geo, Dates
  common/   HttpError, Validate, M (row helpers)
        |  SQL (JdbcTemplate)
H2 database (file ./data/drinkit.mv.db), tables are created from src/main/resources/schema.sql
```

* **Orders** run inside one database transaction: stock is reduced with `UPDATE ... WHERE stock >= qty`, so two buyers can never take the last bottle.
* **Flow:** placed -> accepted -> packed -> out_for_delivery -> delivered (or cancelled). Delivery needs the customer's 4-digit OTP and the rider confirming an ID check.
* **Login:** customers use phone + OTP. Admin and riders use phone + the shared `STAFF_PASSWORD`.
* **Age rules** are per state (Delhi 25, Karnataka 21, Maharashtra 25, West Bengal 21, Rajasthan: no home delivery).
