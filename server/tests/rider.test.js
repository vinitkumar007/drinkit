const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, PLACES, ADDRESS } = require('./helpers');

describe('rider delivery', () => {
  let ctx, admin, rider, rider2, customer;
  before(async () => {
    ctx = await startServer();
    admin = await ctx.login('9000000001');
    rider = await ctx.login('9000000002');   // Delhi CP (store 1)
    rider2 = await ctx.login('9000000003');  // Bengaluru (store 3)
    customer = await ctx.adultCustomer('9777777771', 'Cust');
  });
  after(() => ctx.close());

  const place = (items = [{ product_id: 30, qty: 2 }], extra = {}) =>
    ctx.api('POST', '/api/orders', { address: ADDRESS, ...PLACES.CP, items, ...extra }, customer);
  const adminStatus = (id, status) => ctx.api('PATCH', `/api/admin/orders/${id}/status`, { status }, admin);
  const R = (method, url, body, token = rider) => ctx.api(method, url, body, token);

  async function packed() {
    const o = (await place()).data;
    await adminStatus(o.id, 'accepted');
    await adminStatus(o.id, 'packed');
    return o;
  }
  async function outForDelivery() {
    const o = await packed();
    assert.equal((await R('POST', `/api/rider/orders/${o.id}/pickup`)).status, 200);
    return o;
  }

  it('is only for riders', async () => {
    assert.equal((await ctx.api('GET', '/api/rider/orders')).status, 401);
    assert.equal((await ctx.api('GET', '/api/rider/orders', null, customer)).status, 403);
    assert.equal((await ctx.api('GET', '/api/rider/orders', null, admin)).status, 403);
  });

  it('only sees jobs that are packed or out for delivery, without the OTP', async () => {
    const o = (await place()).data;
    assert.equal((await R('GET', '/api/rider/orders')).data.find((j) => j.id === o.id), undefined); // still "placed"
    await adminStatus(o.id, 'accepted');
    await adminStatus(o.id, 'packed');
    const jobs = (await R('GET', '/api/rider/orders')).data;
    const job = jobs.find((j) => j.id === o.id);
    assert.ok(job);
    assert.equal(job.delivery_otp, undefined);
    assert.equal(job.customer_name, 'Cust');
    assert.ok(job.customer_phone, 'rider can call the customer');
  });

  it("cannot see or act on another store's rider's orders", async () => {
    const o = await packed();
    assert.equal((await R('GET', '/api/rider/orders', null, rider2)).data.length, 0);
    assert.equal((await R('POST', `/api/rider/orders/${o.id}/pickup`, null, rider2)).status, 404);
    assert.equal((await R('GET', `/api/orders/${o.id}`, null, rider2)).status, 403);
    assert.equal((await R('GET', `/api/orders/${o.id}`, null, rider)).status, 200);
  });

  it('cannot pick up an order that is not packed', async () => {
    const o = (await place()).data;
    assert.equal((await R('POST', `/api/rider/orders/${o.id}/pickup`)).status, 409);
  });

  it('completes a delivery only with the right OTP AND a confirmed ID check', async () => {
    const o = await outForDelivery();
    const deliver = (body) => R('POST', `/api/rider/orders/${o.id}/deliver`, body);

    assert.equal((await deliver({ otp: o.delivery_otp })).status, 400);                         // no ID check
    assert.equal((await deliver({ otp: o.delivery_otp, id_checked: 'yes' })).status, 400);       // must be literally true
    assert.equal((await deliver({ otp: '0000', id_checked: true })).status, 400);                // wrong OTP
    assert.equal((await ctx.api('GET', `/api/orders/${o.id}`, null, customer)).data.status, 'out_for_delivery');

    assert.equal((await deliver({ otp: o.delivery_otp, id_checked: true })).status, 200);
    const done = (await ctx.api('GET', `/api/orders/${o.id}`, null, customer)).data;
    assert.equal(done.status, 'delivered');
    assert.equal(done.id_checked, 1);
    assert.equal(done.payment_status, 'paid');                                                    // COD collected
    assert.deepEqual(done.events.map((e) => e.status), ['placed', 'accepted', 'packed', 'out_for_delivery', 'delivered']);
    assert.equal(done.events.at(-1).actor_role, 'rider');
    assert.equal((await deliver({ otp: o.delivery_otp, id_checked: true })).status, 409);        // not twice
  });

  it('locks the delivery after 5 wrong OTPs, even if the right one is then entered', async () => {
    const o = await outForDelivery();
    const deliver = (otp) => R('POST', `/api/rider/orders/${o.id}/deliver`, { otp, id_checked: true });
    for (let i = 0; i < 5; i++) assert.equal((await deliver('0000')).status, 400);
    assert.equal((await deliver(o.delivery_otp)).status, 403);
    // Admin re-assigning the rider resets the counter.
    const riders = (await ctx.api('GET', '/api/admin/riders', null, admin)).data;
    await ctx.api('POST', `/api/admin/orders/${o.id}/assign`, { rider_id: riders.find((r) => r.store_id === 1).id }, admin);
    assert.equal((await deliver(o.delivery_otp)).status, 200);
  });

  it('refusing (no ID / underage / intoxicated) cancels the order and restocks', async () => {
    const before = await ctx.stockOf(1, 30);
    const o = await outForDelivery();
    assert.equal(await ctx.stockOf(1, 30), before - 2);
    const r = await R('POST', `/api/rider/orders/${o.id}/refuse`, { reason: 'Customer had no ID' });
    assert.equal(r.status, 200);
    assert.equal(await ctx.stockOf(1, 30), before);
    const cancelled = (await ctx.api('GET', `/api/orders/${o.id}`, null, customer)).data;
    assert.equal(cancelled.status, 'cancelled');
    assert.equal(cancelled.events.at(-1).note, 'Customer had no ID');
    assert.equal((await R('POST', `/api/rider/orders/${o.id}/refuse`)).status, 409);
  });

  it('writes deliveries and refusals to the audit log', async () => {
    const log = (await ctx.api('GET', '/api/admin/audit', null, admin)).data;
    const actions = new Set(log.map((l) => l.action));
    assert.ok(actions.has('order.delivered'));
    assert.ok(actions.has('order.refused'));
  });

  it('shows a rider profile and respects availability for new assignments', async () => {
    const me = (await R('GET', '/api/rider/me')).data;
    assert.equal(me.store, 'Drinkit Hub - Connaught Place');
    assert.ok(me.delivered >= 2);
    assert.equal(me.available, true);

    assert.equal((await R('PATCH', '/api/rider/availability', { available: false })).status, 200);
    assert.equal((await R('GET', '/api/rider/me')).data.available, false);
    const noRider = (await place()).data;          // the only rider at store 1 is unavailable
    assert.equal(noRider.rider_id, null);
    await R('PATCH', '/api/rider/availability', { available: true });
    assert.ok((await place()).data.rider_id);
  });
});
