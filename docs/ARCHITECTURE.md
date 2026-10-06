# Architecture

```
Browser (3 apps)            Node server                         Database
web/ (customer)  ─┐      ┌─ routes/    HTTP only: parse, call service, send JSON
web/admin        ─┼─ HTTPS ─ middleware/ auth (JWT), roles, errors
web/rider        ─┘      ├─ services/  ALL business rules (orders, stock, age, coupons)
                         └─ db/        SQLite (node:sqlite), SQL migrations
```

## Rules of the road
- **routes are thin.** A route reads the request, calls one service function, returns JSON.
- **services own the rules.** Stock, pricing, age, ID check and status flow live in `server/services/`. The browser is never trusted for prices or permissions.
- **one transaction per order.** `db.transaction()` uses `BEGIN IMMEDIATE`, so two customers can never buy the last bottle.
- **migrations are append-only.** Add `server/db/migrations/003_name.sql`; never edit an applied file.

## Order life cycle
`placed → accepted → packed → out_for_delivery → delivered` (admin moves the first three, the rider the last two).
Cancel is possible until `packed` (customer) or before delivery (admin). A rider can refuse at the door. Cancelling or refusing restocks.

## Legal safeguards built in
1. State rules table: minimum age and whether home delivery is allowed, per state.
2. Age declared at checkout and re-checked against the serving store's state.
3. Rider cannot complete delivery without the customer's OTP **and** confirming a physical ID check.
4. Wrong OTP is limited to 5 attempts; admin must intervene after that.
5. Max 12 items per order. Store opening hours (IST) enforced.
6. Audit log of admin and rider actions.

## Frontend
Vanilla ES modules, no build step, no inline scripts (the server sends a strict CSP).
`web/shared/` holds the design tokens (`base.css`) and helpers used by all three apps. Text is always inserted with `textContent` (see `shared/dom.js`) so user data cannot inject HTML.

## Folder map
```
server/
  index.js, app.js        start-up and wiring
  config.js               all settings (env overridable)
  db/                     connection, migrations/, seed.js
  lib/                    mini http framework, jwt, validation, security headers
  middleware/             auth, errors
  routes/                 auth, catalog, addresses, orders, admin, rider
  services/               auth, age, stores, catalog, coupons, orders, admin, addresses, audit, geo
  tests/                  99 tests, one process + throwaway DB per file
web/
  index.html, customer/   customer app (pages/, components/, state.js)
  admin/                  admin console (pages/)
  rider/                  rider app
  shared/                 base.css, dom, api, ui, session, login
scripts/                  check-web.js (static checks), e2e-browser.js (real browser)
```
