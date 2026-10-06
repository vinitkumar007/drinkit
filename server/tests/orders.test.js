const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, PLACES, ADDRESS } = require('./helpers');

describe('customer orders', () => {
  let ctx, alice, admin;
  before(async () => {
    ctx = await startServer();
    alice = await ctx.adultCustomer('9333333331', 'Alice');
    admin = await ctx.login('9000000001');
  });
  after(() => ctx.close());

  const order = (token, body) => ctx.api('POST', '/api/orders', { address: ADDRESS, ...PLACES.CP, ...body }, token);

  it('places an order with correct totals, delivery fee, rider and OTP', async () => {
    const r = await order(alice, { items: [{ product_id: 1, qty: 1 }, { product_id: 30, qty: 2 }] });
    assert.equal(r.status, 201);
    const o = r.data;
    assert.equal(o.status, 'placed');
    assert.equal(o.subtotal, 1250 + 95 * 2);
    assert.equal(o.delivery_fee, 0);                       // >= 1000 is free
    assert.equal(o.total, o.subtotal);
    assert.equal(o.store_id, 1);
    assert.ok(o.rider_id, 'a rider is auto-assigned');
    assert.match(o.delivery_otp, /^\d{4}$/);
    assert.equal(o.items.length, 2);
    assert.deepEqual(o.events.map((e) => e.status), ['placed']);
  });

  it('charges a delivery fee on small orders', async () => {
    const r = await order(alice, { items: [{ product_id: 30, qty: 1 }] });
    assert.equal(r.data.delivery_fee, 30);
    assert.equal(r.data.total, 95 + 30);
  });

  it('merges duplicate lines for the same product', async () => {
    const r = await order(alice, { items: [{ product_id: 30, qty: 1 }, { product_id: 30, qty: 2 }] });
    assert.equal(r.data.items.length, 1);
    assert.equal(r.data.items[0].qty, 3);
  });

  it('decrements stock when ordering', async () => {
    const before = await ctx.stockOf(1, 7);
    await order(alice, { items: [{ product_id: 7, qty: 3 }] });
    assert.equal(await ctx.stockOf(1, 7), before - 3);
  });

  it('requires age verification', async () => {
    const newbie = await ctx.login('9333333332');
    const r = await order(newbie, { items: [{ product_id: 30, qty: 1 }] });
    assert.equal(r.status, 403);
  });

  it('re-checks age against the store state (22yo verified in Karnataka cannot order in Delhi)', async () => {
    const t = await ctx.login('9333333333');
    const { dobYearsAgo } = require('./helpers');
    await ctx.api('POST', '/api/auth/age', { dob: dobYearsAgo(22), state: 'Karnataka' }, t);
    assert.equal((await order(t, { items: [{ product_id: 30, qty: 1 }] })).status, 403);              // Delhi, min 25
    assert.equal((await order(t, { ...PLACES.BLR, items: [{ product_id: 30, qty: 1 }] })).status, 201); // Bengaluru, min 21
  });

  it('rejects orders outside the service area', async () => {
    const r = await order(alice, { ...PLACES.JAIPUR, items: [{ product_id: 30, qty: 1 }] });
    assert.equal(r.status, 400);
  });

  it('validates the cart and address', async () => {
    assert.equal((await order(alice, { items: [] })).status, 400);
    assert.equal((await order(alice, { items: [{ product_id: 30, qty: 0 }] })).status, 400);
    assert.equal((await order(alice, { items: [{ product_id: 30, qty: -2 }] })).status, 400);
    assert.equal((await order(alice, { items: [{ product_id: 30, qty: 1.5 }] })).status, 400);
    assert.equal((await order(alice, { items: [{ product_id: 9999, qty: 1 }] })).status, 400);
    assert.equal((await order(alice, { address: 'x', items: [{ product_id: 30, qty: 1 }] })).status, 400);
    assert.equal((await order(alice, { payment_method: 'bitcoin', items: [{ product_id: 30, qty: 1 }] })).status, 400);
  });

  it('caps items per order at 12 (per line and in total)', async () => {
    assert.equal((await order(alice, { items: [{ product_id: 30, qty: 13 }] })).status, 400);
    assert.equal((await order(alice, { items: [{ product_id: 30, qty: 7 }, { product_id: 7, qty: 6 }] })).status, 400);
    assert.equal((await order(alice, { items: [{ product_id: 30, qty: 6 }, { product_id: 30, qty: 7 }] })).status, 400);
  });

  it('never oversells and leaves stock untouched on failure', async () => {
    await ctx.api('PATCH', '/api/admin/inventory', { store_id: 1, product_id: 3, stock: 5 }, admin);
    assert.equal((await order(alice, { items: [{ product_id: 3, qty: 6 }] })).status, 409);
    assert.equal(await ctx.stockOf(1, 3), 5);
    assert.equal((await order(alice, { items: [{ product_id: 3, qty: 5 }] })).status, 201);
    assert.equal(await ctx.stockOf(1, 3), 0);
    assert.equal((await order(alice, { items: [{ product_id: 3, qty: 1 }] })).status, 409);
  });

  it('is atomic: a multi-item order that fails halfway changes no stock', async () => {
    await ctx.api('PATCH', '/api/admin/inventory', { store_id: 1, product_id: 4, stock: 1 }, admin);
    const before = await ctx.stockOf(1, 30);
    const r = await order(alice, { items: [{ product_id: 30, qty: 2 }, { product_id: 4, qty: 2 }] });
    assert.equal(r.status, 409);
    assert.equal(await ctx.stockOf(1, 30), before);
  });

  it('handles concurrent orders for the last unit: exactly one wins', async () => {
    await ctx.api('PATCH', '/api/admin/inventory', { store_id: 1, product_id: 5, stock: 1 }, admin);
    const bob = await ctx.adultCustomer('9333333334', 'Bob');
    const results = await Promise.all([
      order(alice, { items: [{ product_id: 5, qty: 1 }] }),
      order(bob, { items: [{ product_id: 5, qty: 1 }] }),
    ]);
    assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
    assert.equal(await ctx.stockOf(1, 5), 0);
  });

  it('shows the delivery OTP only to the customer who placed the order', async () => {
    const o = (await order(alice, { items: [{ product_id: 30, qty: 1 }] })).data;
    const mine = await ctx.api('GET', `/api/orders/${o.id}`, null, alice);
    assert.equal(mine.data.delivery_otp, o.delivery_otp);
    const asAdmin = await ctx.api('GET', `/api/orders/${o.id}`, null, admin);
    assert.equal(asAdmin.status, 200);
    assert.equal(asAdmin.data.delivery_otp, undefined);
    assert.equal(asAdmin.data.otp_attempts, undefined);
  });

  it("does not let other customers see someone's order", async () => {
    const o = (await order(alice, { items: [{ product_id: 30, qty: 1 }] })).data;
    const eve = await ctx.login('9333333335');
    assert.equal((await ctx.api('GET', `/api/orders/${o.id}`, null, eve)).status, 403);
    assert.equal((await ctx.api('POST', `/api/orders/${o.id}/cancel`, null, eve)).status, 404);
    assert.equal((await ctx.api('GET', '/api/orders/999999', null, alice)).status, 404);
  });

  it('lists only my orders, newest first', async () => {
    const carol = await ctx.adultCustomer('9333333336', 'Carol');
    const a = (await order(carol, { items: [{ product_id: 30, qty: 1 }] })).data;
    const b = (await order(carol, { items: [{ product_id: 7, qty: 1 }] })).data;
    const list = await ctx.api('GET', '/api/orders', null, carol);
    assert.deepEqual(list.data.map((o) => o.id), [b.id, a.id]);
  });

  it('cancels an order, restores stock and records the event', async () => {
    const before = await ctx.stockOf(1, 8);
    const o = (await order(alice, { items: [{ product_id: 8, qty: 4 }] })).data;
    assert.equal(await ctx.stockOf(1, 8), before - 4);
    const c = await ctx.api('POST', `/api/orders/${o.id}/cancel`, null, alice);
    assert.equal(c.status, 200);
    assert.equal(c.data.status, 'cancelled');
    assert.equal(await ctx.stockOf(1, 8), before);
    assert.deepEqual(c.data.events.map((e) => e.status), ['placed', 'cancelled']);
    assert.equal((await ctx.api('POST', `/api/orders/${o.id}/cancel`, null, alice)).status, 409); // not twice
  });

  it('cannot cancel once the order is packed', async () => {
    const o = (await order(alice, { items: [{ product_id: 30, qty: 1 }] })).data;
    await ctx.api('PATCH', `/api/admin/orders/${o.id}/status`, { status: 'accepted' }, admin);
    assert.equal((await ctx.api('POST', `/api/orders/${o.id}/cancel`, null, alice)).status, 200); // accepted: still ok
    const o2 = (await order(alice, { items: [{ product_id: 30, qty: 1 }] })).data;
    await ctx.api('PATCH', `/api/admin/orders/${o2.id}/status`, { status: 'accepted' }, admin);
    await ctx.api('PATCH', `/api/admin/orders/${o2.id}/status`, { status: 'packed' }, admin);
    assert.equal((await ctx.api('POST', `/api/orders/${o2.id}/cancel`, null, alice)).status, 409);
  });

  it('marks UPI/card orders as paid and COD as pending', async () => {
    const cod = (await order(alice, { items: [{ product_id: 30, qty: 1 }], payment_method: 'cod' })).data;
    const upi = (await order(alice, { items: [{ product_id: 30, qty: 1 }], payment_method: 'upi' })).data;
    assert.equal(cod.payment_status, 'pending');
    assert.equal(upi.payment_status, 'paid');
  });

  it('uses a saved address by id', async () => {
    const a = await ctx.api('POST', '/api/addresses', { label: 'Home', address: '5 Rajpath Lane, New Delhi', ...PLACES.CP }, alice);
    const r = await ctx.api('POST', '/api/orders', { address_id: a.data.id, items: [{ product_id: 30, qty: 1 }] }, alice);
    assert.equal(r.status, 201);
    assert.equal(r.data.address, '5 Rajpath Lane, New Delhi');
    const eve = await ctx.adultCustomer('9333333337', 'Eve');
    assert.equal((await ctx.api('POST', '/api/orders', { address_id: a.data.id, items: [{ product_id: 30, qty: 1 }] }, eve)).status, 404);
  });

  it('routes orders to the nearest store (Saket customer -> store 2)', async () => {
    const r = await order(alice, { ...PLACES.SAKET, items: [{ product_id: 30, qty: 1 }] });
    assert.equal(r.data.store_id, 2);
  });
});
