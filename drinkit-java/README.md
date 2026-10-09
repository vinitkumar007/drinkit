# Drinkit (Java / Spring Boot)

Licensed, age-verified alcohol delivery: customer app, admin console, rider app, REST API and database.
Backend: **Java 17 + Spring Boot 3 + JDBC + H2**. The three web apps are plain HTML/JS served by Spring Boot itself.

## Run in VS Code (Windows)
1. Install **JDK 17 or newer** and **Apache Maven**. Check in the terminal:
   ```
   java -version
   mvn -v
   ```
2. In VS Code install the extension **Extension Pack for Java** (Microsoft).
3. Open this folder (the one that contains `pom.xml`) with *File -> Open Folder*.
4. In the VS Code terminal (PowerShell):
   ```
   $env:STAFF_PASSWORD="Drinkit@2026"
   mvn spring-boot:run
   ```
   The first run downloads libraries, so wait a few minutes. When you see `Started DrinkitApplication`, open http://localhost:3000
5. Stop the server with `Ctrl + C`. Do not start it twice (the database file is locked by the first one).

| App | URL | Login |
|---|---|---|
| Customer | `/` | any 10 digit number + OTP (shown on screen locally) |
| Admin | `/admin/` | 9000000001 + staff password |
| Rider | `/rider/` | 9000000002 (Delhi CP), 9000000003 (Bengaluru), 9000000004 (Saket), 9000000005 (Mumbai), 9000000006 (Kolkata) + staff password |

**Try the whole flow:** customer picks *Connaught Place, Delhi*, adds items, checks out (age 25+, address, coupon `WELCOME100`) -> Admin: *Orders* -> Accept -> Mark packed -> Rider `9000000002`: pick up, tick the ID check, enter the customer's OTP -> customer sees *Delivered*.

## Commands
| | |
|---|---|
| `mvn spring-boot:run` | run the app |
| `mvn test` | unit tests + a full HTTP order-flow test |
| `mvn package` | build `target/drinkit.jar` |
| `java -jar target/drinkit.jar` | run the built jar |

## Settings (environment variables)
See `.env.example`. Important: `JWT_SECRET` (required when `APP_ENV=production`), `STAFF_PASSWORD` (min 8 characters), `DEMO_OTP=1` (show customer OTP on screen until an SMS provider is connected).

## Deploy on Render
Create a **Web Service** from this repo with *Runtime: Docker* (the `Dockerfile` is included). Add the environment variables from `.env.example`. On the free plan the H2 database file is erased on every redeploy; for real use attach a disk mounted at `/data` or move to PostgreSQL.

## Docs
[Architecture](docs/ARCHITECTURE.md) - [API](docs/API.md) - [Legal notes](docs/LEGAL.md)

## Still demo (replace before launch)
SMS OTP, payments (UPI/card are mocked), KYC, demo stores and licence numbers, H2 -> PostgreSQL for several servers.

> Alcohol consumption is injurious to health. Do not drink and drive.
