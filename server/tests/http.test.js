// HTTP-level behaviour: static apps, security headers, body parsing.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helpers');

describe('http layer', () => {
  let ctx;
  before(async () => { ctx = await startServer(); });
  after(() => ctx.close());

  const get = (p, opts) => fetch(ctx.base + p, { redirect: 'manual', ...opts });

  it('serves the three apps', async () => {
    for (const p of ['/', '/admin/', '/rider/']) {
      const r = await get(p);
      assert.equal(r.status, 200, p);
      assert.match(r.headers.get('content-type'), /text\/html/);
    }
  });

  it('redirects /admin and /rider to a trailing slash', async () => {
    for (const p of ['/admin', '/rider']) {
      const r = await get(p);
      assert.equal(r.status, 301);
      assert.equal(r.headers.get('location'), p + '/');
    }
  });

  it('serves JS and CSS with correct content types', async () => {
    assert.match((await get('/customer/main.js')).headers.get('content-type'), /javascript/);
    assert.match((await get('/shared/base.css')).headers.get('content-type'), /text\/css/);
  });

  it('blocks path traversal and does not leak server files', async () => {
    for (const p of ['/../package.json', '/..%2fpackage.json', '/%2e%2e/server/config.js', '/server/config.js', '/../data/drinkit.db']) {
      const r = await get(p);
      assert.equal(r.status, 404, p);
    }
  });

  it('sets security headers including a CSP without unsafe-inline scripts', async () => {
    const r = await get('/');
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(r.headers.get('x-frame-options'), 'SAMEORIGIN');
    const csp = r.headers.get('content-security-policy');
    assert.match(csp, /script-src 'self'/);
    assert.doesNotMatch(csp, /script-src[^;]*unsafe-inline/);
  });

  it('answers CORS preflight', async () => {
    const r = await get('/api/orders', { method: 'OPTIONS' });
    assert.equal(r.status, 204);
    assert.equal(r.headers.get('access-control-allow-origin'), '*');
  });

  it('rejects malformed and oversized JSON', async () => {
    const bad = await fetch(ctx.base + '/api/auth/request-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{not json' });
    assert.equal(bad.status, 400);
    const big = await fetch(ctx.base + '/api/auth/request-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: 'x'.repeat(200 * 1024) }) }).catch(() => ({ status: 413 }));
    assert.equal(big.status, 413);
  });

  it('wrong HTTP method on a known route is a 404, not a crash', async () => {
    assert.equal((await get('/api/categories', { method: 'POST' })).status, 404);
  });
});
