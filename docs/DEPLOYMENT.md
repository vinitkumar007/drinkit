# Deployment

## Quick start (any machine with Node 22.5+)
```bash
node server/index.js          # http://localhost:3000
```
Customer `/`, admin `/admin/`, rider `/rider/`. Demo data is created on first start.

## Docker
```bash
echo "JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")" > .env
docker compose up -d --build
```
The database lives in the `drinkit-data` volume. **Back it up** (copy `drinkit.db`, or `sqlite3 drinkit.db ".backup out.db"`).

## Environment variables (Render, Docker or any host)
| Name | Required | What it does |
|---|---|---|
| `JWT_SECRET` | yes (production) | long random text that signs logins |
| `STAFF_PASSWORD` | yes, to use /admin and /rider | password for every admin and rider account (min 8 chars). Change the variable and redeploy to change the password |
| `DEMO_OTP` | optional | `1` shows the OTP on screen for customers only, for demos before SMS is connected. Staff numbers never get it. Remove it once SMS is live |
| `NODE_ENV` | yes | `production` (the Dockerfile sets it) |
| `DB_FILE` | optional | database path. On Render free plans the disk is wiped on every deploy, so attach a persistent disk or accept that demo data resets |

## Before real customers (checklist)
- [ ] Set `NODE_ENV=production`, a strong `JWT_SECRET` and a strong `STAFF_PASSWORD`. Remove `DEMO_OTP` once real SMS works.
- [ ] Put HTTPS in front (Caddy, nginx or your host's load balancer).
- [ ] Replace the OTP `console.log` in `server/services/auth.js` with a real SMS provider (MSG91, Gupshup, Twilio).
- [ ] Replace demo UPI/card with a payment gateway (Razorpay, Cashfree) and mark orders paid from its webhook.
- [ ] Add real age/KYC verification (DigiLocker or a licensed eKYC partner).
- [ ] Remove demo staff numbers (9000000001...) and create real admin/rider users.
- [ ] Replace demo stores, licence numbers and state rules with verified ones (see LEGAL.md).
- [ ] Move to PostgreSQL when you need more than one server. SQL is plain; change `AUTOINCREMENT` and date columns.
- [ ] Add monitoring and error reporting; schedule database backups.

## Scaling notes
SQLite handles a single store network comfortably. Beyond that: PostgreSQL, a queue for notifications, WebSockets or push for live order updates (the apps poll every 5-10 s today), and GPS tracking for riders.
