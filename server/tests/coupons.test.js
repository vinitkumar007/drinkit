const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, PLACES, ADDRESS } = require('./helpers');

describe('coupons', () => {
  let ctx, user, admin;
  before(async () => {
    ctx = await startServer();
    user = await ctx.adultCustomer('9444444441', 'Coupon User');
    admin = await ctx.login('9000000001');
  });
  after(() => ctx.close());

  const validate = (code, subtotal) => ctx.api('POST', '/api/coupons/validate', { code, subtotal }, user);
  const order = (body) => ctx.api('POST', '/api/orders', { address: ADDRESS, ...PLACES.CP, ...body }, user);

  it('requires login', async () => {
    assert.equal((await ctx.api('POST', '/api/coupons/validate', { code: 'DRINK10', subtotal: 1000 })).status, 401);
  });

  it('applies a flat coupon above the minimum (case-insensitive)', async () => {
    const r = await validate('welcome100', 1500);
    assert.equal(r.status, 200);
    assert.deepEqual({ code: r.data.code, discount: r.data.discount }, { code: 'WELCOME100', discount: 100 });
  });

  it('rejects below the minimum subtotal', async () => {
    const r = await validate('WELCOME100', 500);
    assert.equal(r.status, 400);
    assert.match(r.data.error, /999/);
  });

  it('percent coupons are capped by max discount', async () => {
    assert.equal((await validate('DRINK10', 600)).data.discount, 60);
    assert.equal((await validate('DRINK10', 3000)).data.discount, 150);
  });

  it('rejects unknown coupons', async () => {
    assert.equal((await validate('NOPE', 1000)).status, 400);
    assert.equal((await ctx.api('POST', '/api/coupons/validate', { subtotal: 1000 }, user)).status, 400);
  });

  it('discount is applied to the real order and fee uses the discounted amount', async () => {
    // 1100 subtotal - 100 = 1000 -> still free delivery
    const a = await order({ items: [{ product_id: 13, qty: 1 }], coupon_code: 'WELCOME100' });
    assert.equal(a.status, 201);
    assert.equal(a.data.subtotal, 1100);
    assert.equal(a.data.discount, 100);
    assert.equal(a.data.coupon_code, 'WELCOME100');
    assert.equal(a.data.delivery_fee, 0);
    assert.equal(a.data.total, 1000);
    // 1050 - 100 = 950 -> below free-delivery threshold, fee applies
    const b = await order({ items: [{ product_id: 25, qty: 1 }], coupon_code: 'WELCOME100' });
    assert.equal(b.data.total, 950 + 30);
  });

  it('a bad coupon fails the order and does not consume stock', async () => {
    const before = await ctx.stockOf(1, 13);
    const r = await order({ items: [{ product_id: 13, qty: 1 }], coupon_code: 'NOPE' });
    assert.equal(r.status, 400);
    assert.equal(await ctx.stockOf(1, 13), before);
  });

  it('admin can create, disable and re-enable coupons', async () => {
    const c = await ctx.api('POST', '/api/admin/coupons', { code: 'flat50', type: 'flat', value: 50, min_subtotal: 100 }, admin);
    assert.equal(c.status, 201);
    assert.equal(c.data.code, 'FLAT50');
    assert.equal((await validate('FLAT50', 200)).data.discount, 50);

    await ctx.api('PATCH', '/api/admin/coupons/FLAT50', { active: false }, admin);
    assert.equal((await validate('FLAT50', 200)).status, 400);
    await ctx.api('PATCH', '/api/admin/coupons/FLAT50', { active: true }, admin);
    assert.equal((await validate('FLAT50', 200)).status, 200);
  });

  it('admin coupon validation: duplicates, bad types, percent > 100', async () => {
    assert.equal((await ctx.api('POST', '/api/admin/coupons', { code: 'DRINK10', type: 'flat', value: 5 }, admin)).status, 409);
    assert.equal((await ctx.api('POST', '/api/admin/coupons', { code: 'X1', type: 'flat', value: 5 }, admin)).status, 400);      // too short
    assert.equal((await ctx.api('POST', '/api/admin/coupons', { code: 'ABC', type: 'bogus', value: 5 }, admin)).status, 400);
    assert.equal((await ctx.api('POST', '/api/admin/coupons', { code: 'BIGPCT', type: 'percent', value: 150 }, admin)).status, 400);
    assert.equal((await ctx.api('POST', '/api/admin/coupons', { code: 'BAD-CODE', type: 'flat', value: 5 }, admin)).status, 400);
    assert.equal((await ctx.api('PATCH', '/api/admin/coupons/NOSUCH', { active: false }, admin)).status, 404);
  });

  it('expired coupons are rejected', async () => {
    await ctx.api('POST', '/api/admin/coupons', { code: 'OLD10', type: 'flat', value: 10, expires_at: '2020-01-01' }, admin);
    const r = await validate('OLD10', 500);
    assert.equal(r.status, 400);
    assert.match(r.data.error, /expire/);
  });

  it('a coupon never discounts more than the subtotal', async () => {
    await ctx.api('POST', '/api/admin/coupons', { code: 'HUGE', type: 'flat', value: 5000 }, admin);
    assert.equal((await validate('HUGE', 200)).data.discount, 200);
  });
});
