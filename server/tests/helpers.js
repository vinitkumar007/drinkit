// Shared test harness. Each test file runs in its own process with its own throwaway database.
const os = require('os');
const path = require('path');

process.env.DB_FILE = path.join(os.tmpdir(), `drinkit-test-${process.pid}-${Date.now()}.db`);
process.env.IGNORE_STORE_HOURS = '1';
process.env.AUTH_RATE_MAX = '100000';

const { buildApp } = require('../app');

const PLACES = {
  CP: { lat: 28.633, lng: 77.218 },         // Delhi, Connaught Place  -> store 1
  SAKET: { lat: 28.5245, lng: 77.2066 },    // Delhi, Saket            -> store 2
  BLR: { lat: 12.979, lng: 77.641 },        // Bengaluru               -> store 3
  MUMBAI: { lat: 19.0596, lng: 72.8295 },   // Mumbai Bandra           -> store 4
  KOLKATA: { lat: 22.5535, lng: 88.3523 },  // Kolkata Park Street     -> store 5
  JAIPUR: { lat: 26.9124, lng: 75.7873 },   // no store here
};
const ADDRESS = '12 Test Road, Connaught Place';

const dobYearsAgo = (years) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  d.setDate(d.getDate() - 2); // comfortably past the birthday
  return d.toISOString().slice(0, 10);
};

async function startServer() {
  const server = buildApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  async function api(method, url, body, token) {
    const r = await fetch(base + url, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, data: await r.json().catch(() => ({})), headers: r.headers };
  }

  async function login(phone, name) {
    const o = await api('POST', '/api/auth/request-otp', { phone });
    const v = await api('POST', '/api/auth/verify-otp', { phone, otp: o.data.dev_otp, name });
    if (v.status !== 200) throw new Error('login failed: ' + JSON.stringify(v.data));
    return v.data.token;
  }

  // A customer old enough for every state we seed (25+), already age-verified in Delhi.
  async function adultCustomer(phone, name = 'Test Customer') {
    const token = await login(phone, name);
    const r = await api('POST', '/api/auth/age', { dob: dobYearsAgo(30), state: 'Delhi' }, token);
    if (r.status !== 200) throw new Error('age verify failed');
    return token;
  }

  const stockOf = async (storeId, productId) => {
    const r = await api('GET', `/api/products?store_id=${storeId}`);
    return r.data.find((p) => p.id === productId).stock;
  };

  const close = () => new Promise((r) => server.close(r));
  return { server, base, api, login, adultCustomer, stockOf, close };
}

module.exports = { startServer, PLACES, ADDRESS, dobYearsAgo };
