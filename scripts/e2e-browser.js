// Real-browser end-to-end test of all three apps. Needs Playwright + Chromium installed.
//   NODE_PATH=$(npm root -g) node scripts/e2e-browser.js [screenshot-dir]
// Flow: customer orders -> admin accepts and packs -> rider picks up and delivers -> customer sees "Delivered".
const { spawn } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');

let chromium;
try { ({ chromium } = require('playwright')); } catch { console.error('playwright is not installed (npm i -D playwright).'); process.exit(2); }

const PORT = 3900 + Math.floor(Math.random() * 90);
const BASE = `http://127.0.0.1:${PORT}`;
const SHOTS = process.argv[2] || null;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

const problems = [];
let step = 0;
const say = (m) => console.log(`  ${++step}. ${m}`);

function watch(page, name) {
  page.on('pageerror', (e) => problems.push(`[${name}] page error: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/status of 400/.test(m.text())) problems.push(`[${name}] console error: ${m.text()}`); });
  page.on('requestfailed', (r) => problems.push(`[${name}] request failed: ${r.url()}`));
}
const shot = (page, name) => SHOTS && page.screenshot({ path: path.join(SHOTS, name + '.png') });

async function login(page, phone, name) {
  await page.fill('input[type=tel]', phone);
  await page.click('text=Send OTP');
  await page.waitForSelector('input[autocomplete=one-time-code]');
  const nameBox = page.locator('input[autocomplete=name]');
  if (name && await nameBox.count()) await nameBox.fill(name);
  await page.click('text=Verify and continue');
}

(async () => {
  const server = spawn(process.execPath, ['--no-warnings', path.join(__dirname, '..', 'server', 'index.js')], {
    env: { ...process.env, PORT, DB_FILE: path.join(os.tmpdir(), `drinkit-e2e-${process.pid}.db`), IGNORE_STORE_HOURS: '1', AUTH_RATE_MAX: '100000' },
    stdio: 'ignore',
  });
  for (let i = 0; i < 50; i++) { try { if ((await fetch(BASE + '/api/health')).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }

  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  try {
    // ---------- customer (phone-sized) ----------
    const cust = await browser.newContext({ viewport: { width: 390, height: 844 }, geolocation: { latitude: 28.633, longitude: 77.218 }, permissions: ['geolocation'] });
    const c = await cust.newPage(); watch(c, 'customer');
    await c.goto(BASE + '/');
    await c.waitForSelector('text=Or pick a city');
    await shot(c, '01-location');
    say('location gate shows');
    await c.click('text=Connaught Place, Delhi');
    await c.waitForSelector('.prod');
    await shot(c, '02-shop');
    say('shop loads with products: ' + await c.locator('.prod').count());
    if (await c.locator('.seal').count() !== 1) problems.push('ETA seal missing');

    await c.fill('input[type=search]', 'vodka');
    await c.waitForFunction(() => document.querySelectorAll('.prod').length === 4);
    say('search narrows to 4 vodkas');
    await c.fill('input[type=search]', '');
    await c.click('.chip:has-text("Whisky")');
    await c.locator('.prod .add').first().click();
    await c.locator('.prod .stepper button[aria-label^="Add one"]').first().click();
    await c.waitForSelector('.cartbar');
    await shot(c, '03-cart');
    say('cart bar: ' + (await c.locator('.cartbar').innerText()).replace(/\s+/g, ' '));

    await c.click('.cartbar');
    await login(c, '9812345678', 'Test Customer');
    await c.waitForSelector('text=Confirm my age');
    await shot(c, '04-age');
    const d = new Date(); d.setFullYear(d.getFullYear() - 30);
    await c.fill('input[type=date]', d.toISOString().slice(0, 10));
    await c.click('text=Confirm my age');
    await c.waitForSelector('textarea');
    await c.fill('textarea', '12 Test Road, Connaught Place, New Delhi');
    await c.fill('input[placeholder="Coupon code"]', 'welcome100');
    await c.click('text=Apply');
    await c.waitForSelector('text=Applied: WELCOME100');
    await shot(c, '05-checkout');
    say('age check + coupon applied');
    await c.click('button:has-text("Place order")');
    await c.waitForSelector('.otp-code');
    const otp = (await c.locator('.otp-code').innerText()).trim();
    const orderUrl = c.url();
    await shot(c, '06-order');
    say(`order placed, delivery OTP ${otp}`);

    // ---------- admin (desktop) ----------
    const adm = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const a = await adm.newPage(); watch(a, 'admin');
    await a.goto(BASE + '/admin/');            // login sheet opens by itself
    await login(a, '9000000001');
    await a.waitForSelector('text=Open orders');
    await shot(a, '07-admin-dashboard');
    say('admin dashboard');
    await a.click('nav >> text=Orders');
    await a.waitForSelector('.order');
    await a.click('.order >> text=Accept');
    await a.waitForSelector('.order >> text=Mark packed');
    await a.click('.order >> text=Mark packed');
    await a.waitForSelector('.order .badge:has-text("Packed")');
    await shot(a, '08-admin-orders');
    say('admin accepted and packed the order');
    await a.click('nav >> text=Inventory');
    await a.waitForSelector('.stock-in');
    await shot(a, '09-admin-inventory');
    for (const p of ['Products', 'Coupons', 'Stores and riders', 'Audit log']) {
      await a.click(`nav >> text=${p}`);
      await a.waitForSelector('h1:has-text("' + (p === 'Stores and riders' ? 'Stores and riders' : p) + '")');
    }
    await shot(a, '10-admin-audit');
    say('admin pages all render');

    // ---------- rider (phone) ----------
    const rid = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const r = await rid.newPage(); watch(r, 'rider');
    await r.goto(BASE + '/rider/');
    await login(r, '9000000002');
    await r.waitForSelector('.job');
    await shot(r, '11-rider-job');
    await r.click('text=I have picked up this order');
    await r.waitForSelector('text=Complete delivery');
    await r.click('text=Complete delivery');           // must fail: no ID check, no OTP
    await r.waitForSelector('.toast.err');
    say('delivery blocked without ID check + OTP');
    await r.check('input[type=checkbox][id^="id-"]');
    await r.fill('input[aria-label="Customer delivery OTP"]', otp);
    await shot(r, '12-rider-deliver');
    await r.click('text=Complete delivery');
    await r.waitForSelector('text=No orders right now');
    say('rider delivered with ID check + OTP');

    // ---------- customer sees delivered ----------
    await c.goto(orderUrl);
    await c.reload();
    await c.waitForSelector('.badge.delivered');
    await shot(c, '13-order-delivered');
    say('customer sees Delivered');

    if (problems.length) { console.error('\nProblems:\n - ' + problems.join('\n - ')); process.exitCode = 1; }
    else console.log('\nBrowser e2e passed with no console errors.');
  } catch (e) {
    console.error('\nFAILED at step', step + 1, '-', e.message.split('\n')[0]);
    if (problems.length) console.error(' - ' + problems.join('\n - '));
    process.exitCode = 1;
  } finally {
    await browser.close();
    server.kill();
  }
})();
