const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, PLACES } = require('./helpers');

describe('serviceability + catalog', () => {
  let ctx;
  before(async () => { ctx = await startServer(); });
  after(() => ctx.close());

  const svc = (p) => ctx.api('GET', `/api/serviceability?lat=${p.lat}&lng=${p.lng}`);

  it('finds the right store in each supported city', async () => {
    const expected = { CP: 1, SAKET: 2, BLR: 3, MUMBAI: 4, KOLKATA: 5 };
    for (const [place, storeId] of Object.entries(expected)) {
      const r = await svc(PLACES[place]);
      assert.equal(r.data.serviceable, true, place);
      assert.equal(r.data.store.id, storeId, place);
      assert.ok(r.data.eta_minutes >= 8 && r.data.eta_minutes <= 15, `${place} eta ${r.data.eta_minutes}`);
    }
  });

  it('reports min age of the state with the store', async () => {
    assert.equal((await svc(PLACES.CP)).data.store.min_age, 25);
    assert.equal((await svc(PLACES.BLR)).data.store.min_age, 21);
  });

  it('is not serviceable where there is no store (Jaipur)', async () => {
    const r = await svc(PLACES.JAIPUR);
    assert.equal(r.status, 200);
    assert.equal(r.data.serviceable, false);
    assert.ok(r.data.reason);
  });

  it('rejects invalid coordinates', async () => {
    assert.equal((await ctx.api('GET', '/api/serviceability?lat=abc&lng=1')).status, 400);
    assert.equal((await ctx.api('GET', '/api/serviceability?lat=999&lng=1')).status, 400);
    assert.equal((await ctx.api('GET', '/api/serviceability')).status, 400);
  });

  it('lists categories', async () => {
    const r = await ctx.api('GET', '/api/categories');
    assert.equal(r.data.length, 7);
    assert.ok(r.data.every((c) => c.name && c.emoji));
  });

  it('requires a store for products', async () => {
    assert.equal((await ctx.api('GET', '/api/products')).status, 400);
  });

  it('lists the full catalog for a store with stock', async () => {
    const r = await ctx.api('GET', '/api/products?store_id=1');
    assert.equal(r.data.length, 36);
    assert.ok(r.data.every((p) => Number.isInteger(p.stock) && p.price > 0));
  });

  it('filters by category and searches by name or brand', async () => {
    const beer = await ctx.api('GET', '/api/products?store_id=1&category=2');
    assert.equal(beer.data.length, 6);
    assert.ok(beer.data.every((p) => p.category === 'Beer'));
    const vodka = await ctx.api('GET', '/api/products?store_id=1&q=vodka');
    assert.equal(vodka.data.length, 4);
    const brand = await ctx.api('GET', '/api/products?store_id=1&q=riverside');
    assert.equal(brand.data.length, 4);
    assert.equal((await ctx.api('GET', '/api/products?store_id=1&q=zzzz')).data.length, 0);
  });

  it('treats search text as data (no SQL injection)', async () => {
    const r = await ctx.api('GET', `/api/products?store_id=1&q=${encodeURIComponent("' OR 1=1 --")}`);
    assert.equal(r.status, 200);
    assert.equal(r.data.length, 0);
  });

  it('health endpoint works and unknown API routes 404 as JSON', async () => {
    assert.equal((await ctx.api('GET', '/api/health')).data.ok, true);
    const r = await ctx.api('GET', '/api/does-not-exist');
    assert.equal(r.status, 404);
    assert.ok(r.data.error);
  });
});
