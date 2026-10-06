# Drinkit 🍾

Licensed, age-verified alcohol delivery (quick-commerce style): customer app, admin console, rider app, REST API and database. Zero npm dependencies. Needs **Node 22.5+**.

```bash
node server/index.js     # then open http://localhost:3000
```

| App | URL | Login |
|---|---|---|
| Customer | `/` | any 10-digit number + OTP (OTP shows on screen locally, or in production when `DEMO_OTP=1`) |
| Admin | `/admin/` | 9000000001 + staff password |
| Rider | `/rider/` | 9000000002 (Delhi CP), 9000000003 (Bengaluru) ... 9000000006 + staff password |

Admin and riders log in with a **password**, not an OTP. Set it with the `STAFF_PASSWORD` environment variable (min 8 characters), for example `STAFF_PASSWORD=MyStrongPass123 node server/index.js`. It applies to every admin and rider account.

**Try the whole flow:** pick *Connaught Place, Delhi* → add items → checkout (login, age 25+, address, coupon `WELCOME100`) → in Admin: *Orders* → Accept → Mark packed → in Rider: pick up → tick the ID check and enter the customer's OTP → customer sees *Delivered*.

## Commands
| | |
|---|---|
| `npm start` / `npm run dev` | run (dev auto-restarts) |
| `npm test` | 99 backend tests |
| `npm run check:web` | static checks of the web apps |
| `npm run test:e2e` | real-browser test of all three apps (needs Playwright) |
| `npm run check` | web check + backend tests |

## What is inside
Auth (OTP + JWT) · state-wise age rules · nearest-store routing and ETA · live stock with oversell protection · coupons · saved addresses · order timeline · rider assignment · doorstep OTP + ID check · admin dashboard, inventory, products, coupons, audit log.

Docs: [Architecture](docs/ARCHITECTURE.md) · [API](docs/API.md) · [Deployment](docs/DEPLOYMENT.md) · [Legal notes](docs/LEGAL.md)

## Still demo (replace before launch)
SMS OTP · payments (UPI/card are mocked) · KYC · demo stores and licence numbers · SQLite → PostgreSQL for multi-server. Details in `docs/DEPLOYMENT.md`.

> Alcohol consumption is injurious to health. Do not drink and drive.
