const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, PLACES, ADDRESS } = require('./helpers');

describe('admin', () => {
  let ctx, admin, customer, rider;
  before(async () => {
    ctx = await startServer();
    admin = await ctx.login('9000000001');
    rider = await ctx.login('9000000002');
    customer = await ctx.adultCustomer('9666666661', 'Cust');
  });
  after(() => ctx.close());

  const place = (items, extra = {}) => ctx.api('POST', '/api/orders', { address: ADDRESS, ...PLACES.CP, items, ...extra }, customer);
  const A = (method, url, body) => ctx.api(method, url, body, admin);

  describe('access control', () => {
    it('anonymous -> 401, customer -> 403, rider -> 403', async () => {
      for (const url of ['/api/admin/stats', '/api/admin/orders', '/api/admin/inventory?store_id=1', '/api/admin/products', '/api/admin/coupons', '/api/admin/audit', '/api/admin/riders', '/api/admin/stores']) {
        assert.equal((await ctx.api('GET', url)).status, 401, url);
        assert.equal((await ctx.api('GET', url, null, customer)).status, 403, url);
        assert.equal((await ctx.api('GET', url, null, rider)).status, 403, url);
      }
      assert.equal((await ctx.api('PATCH', '/api/admin/inventory', { store_id: 1, product_id: 1, stock: 9 }, customer)).status, 403);
    });
  });

  describe('order workflow', () => {
    it('moves an order through the full flow and records a timeline', async () => {
      const o = (await place([{ product_id: 30, qty: 1 }])).data;
      for (const s of ['accepted', 'packed', 'out_for_delivery']) {
        const r = await A('PATCH', `/api/admin/orders/${o.id}/status`, { status: s });
        assert.equal(r.status, 200);
        assert.equal(r.data.status, s);
      }
      const final = await A('GET', `/api/orders/${o.id}`);
      assert.deepEqual(final.data.events.map((e) => e.status), ['placed', 'accepted', 'packed', 'out_for_delivery']);
      assert.equal(final.data.events[1].actor_role, 'admin');
    });

    it('rejects skipped, backwards, unknown and delivered transitions', async () => {
      const o = (await place([{ product_id: 30, qty: 1 }])).data;
      assert.equal((await A('PATCH', `/api/admin/orders/${o.id}/status`, { status: 'packed' })).status, 409);
      assert.equal((await A('PATCH', `/api/admin/orders/${o.id}/status`, { status: 'delivered' })).status, 409); // only a rider can deliver
      assert.equal((await A('PATCH', `/api/admin/orders/${o.id}/status`, { status: 'teleported' })).status, 400);
      await A('PATCH', `/api/admin/orders/${o.id}/status`, { status: 'accepted' });
      assert.equal((await A('PATCH', `/api/admin/orders/${o.id}/status`, { status: 'placed' })).status, 409);
      assert.equal((await A('PATCH', '/api/admin/orders/999999/status', { status: 'accepted' })).status, 404);
    });

    it('cancelling restocks and cannot be repeated', async () => {
      const before = await ctx.stockOf(1, 9);
      const o = (await place([{ product_id: 9, qty: 2 }])).data;
      assert.equal((await A('PATCH', `/api/admin/orders/${o.id}/status`, { status: 'cancelled' })).status, 200);
      assert.equal(await ctx.stockOf(1, 9), before);
      assert.equal((await A('PATCH', `/api/admin/orders/${o.id}/status`, { status: 'cancelled' })).status, 409);
    });

    it('lists orders and filters by status', async () => {
      const all = await A('GET', '/api/admin/orders');
      assert.ok(all.data.length >= 3);
      assert.ok(all.data.every((o) => o.delivery_otp === undefined), 'admin never sees delivery OTPs');
      const cancelled = await A('GET', '/api/admin/orders?status=cancelled');
      assert.ok(cancelled.data.length >= 1 && cancelled.data.every((o) => o.status === 'cancelled'));
      assert.equal((await A('GET', '/api/admin/orders?status=bogus')).status, 400);
    });

    it('assigns a rider from the same store only', async () => {
      const o = (await place([{ product_id: 30, qty: 1 }])).data;
      const riders = (await A('GET', '/api/admin/riders')).data;
      const sameStore = riders.find((r) => r.store_id === 1);
      const otherStore = riders.find((r) => r.store_id !== 1);
      assert.equal((await A('POST', `/api/admin/orders/${o.id}/assign`, { rider_id: otherStore.id })).status, 400);
      assert.equal((await A('POST', `/api/admin/orders/${o.id}/assign`, { rider_id: 99999 })).status, 404);
      assert.equal((await A('POST', `/api/admin/orders/${o.id}/assign`, { rider_id: 'abc' })).status, 400);
      const ok = await A('POST', `/api/admin/orders/${o.id}/assign`, { rider_id: sameStore.id });
      assert.equal(ok.status, 200);
      assert.equal(ok.data.rider_id, sameStore.id);
      assert.match(ok.data.events.at(-1).note, /Rider assigned/);
    });
  });

  describe('dashboard data', () => {
    it('returns stats with revenue, status counts, top products and low stock', async () => {
      await A('PATCH', '/api/admin/inventory', { store_id: 2, product_id: 20, stock: 2 });
      const s = (await A('GET', '/api/admin/stats')).data;
      assert.ok(s.orders >= 3 && s.revenue > 0);
      assert.ok(s.today.orders >= 3);
      assert.ok(s.by_status.placed >= 1);
      assert.ok(s.open_orders >= 1);
      assert.ok(Array.isArray(s.top_products) && s.top_products.length > 0);
      assert.ok(s.low_stock.some((l) => l.store_id === 2 && l.product_id === 20 && l.stock === 2));
    });

    it('lists stores and riders', async () => {
      const stores = (await A('GET', '/api/admin/stores')).data;
      assert.equal(stores.length, 5);
      assert.ok(stores.every((s) => s.license_no && s.min_age));
      const riders = (await A('GET', '/api/admin/riders')).data;
      assert.equal(riders.length, 5);
      assert.ok(riders.every((r) => r.name && 'active_jobs' in r && 'delivered' in r));
    });
  });

  describe('inventory', () => {
    it('reads and sets stock per store', async () => {
      const inv = (await A('GET', '/api/admin/inventory?store_id=1')).data;
      assert.equal(inv.length, 36);
      assert.equal((await A('PATCH', '/api/admin/inventory', { store_id: 1, product_id: 6, stock: 77 })).status, 200);
      assert.equal(await ctx.stockOf(1, 6), 77);
    });

    it('validates input', async () => {
      assert.equal((await A('PATCH', '/api/admin/inventory', { store_id: 1, product_id: 6, stock: -1 })).status, 400);
      assert.equal((await A('PATCH', '/api/admin/inventory', { store_id: 1, product_id: 6, stock: 1.5 })).status, 400);
      assert.equal((await A('PATCH', '/api/admin/inventory', { store_id: 99, product_id: 6, stock: 5 })).status, 404);
      assert.equal((await A('PATCH', '/api/admin/inventory', { store_id: 1, product_id: 999, stock: 5 })).status, 404);
      assert.equal((await A('GET', '/api/admin/inventory')).status, 400);
    });
  });

  describe('products', () => {
    it('creates a product that appears in every store with zero stock, then becomes orderable', async () => {
      const c = await A('POST', '/api/admin/products', { category_id: 2, name: 'Test Pilsner', brand: 'Testco', size_ml: 500, abv: 4.5, price: 199 });
      assert.equal(c.status, 201);
      const id = c.data.id;
      const catalog = (await ctx.api('GET', '/api/products?store_id=3')).data;
      assert.equal(catalog.find((p) => p.id === id).stock, 0);
      assert.equal((await place([{ product_id: id, qty: 1 }])).status, 409);              // zero stock
      await A('PATCH', '/api/admin/inventory', { store_id: 1, product_id: id, stock: 10 });
      assert.equal((await place([{ product_id: id, qty: 1 }])).status, 201);
    });

    it('price changes affect new orders but not existing ones', async () => {
      const first = (await place([{ product_id: 10, qty: 1 }])).data;
      assert.equal((await A('PATCH', '/api/admin/products/10', { price: 999 })).status, 200);
      const second = (await place([{ product_id: 10, qty: 1 }])).data;
      assert.equal(first.items[0].price, 260);
      assert.equal(second.items[0].price, 999);
    });

    it('deactivated products disappear from the catalog and cannot be ordered', async () => {
      await A('PATCH', '/api/admin/products/11', { active: false });
      const catalog = (await ctx.api('GET', '/api/products?store_id=1')).data;
      assert.equal(catalog.find((p) => p.id === 11), undefined);
      assert.equal((await place([{ product_id: 11, qty: 1 }])).status, 400);
      await A('PATCH', '/api/admin/products/11', { active: true });
      assert.ok((await ctx.api('GET', '/api/products?store_id=1')).data.find((p) => p.id === 11));
    });

    it('validates product input', async () => {
      assert.equal((await A('POST', '/api/admin/products', { category_id: 99, name: 'X', size_ml: 100, price: 10 })).status, 404);
      assert.equal((await A('POST', '/api/admin/products', { category_id: 1, name: '', size_ml: 100, price: 10 })).status, 400);
      assert.equal((await A('POST', '/api/admin/products', { category_id: 1, name: 'X', size_ml: 100, price: 0 })).status, 400);
      assert.equal((await A('POST', '/api/admin/products', { category_id: 1, name: 'X', size_ml: 100, price: 10, abv: 150 })).status, 400);
      assert.equal((await A('PATCH', '/api/admin/products/9999', { price: 5 })).status, 404);
      assert.equal((await A('PATCH', '/api/admin/products/1', { price: -5 })).status, 400);
    });
  });

  describe('audit log', () => {
    it('records admin actions with the actor', async () => {
      const log = (await A('GET', '/api/admin/audit')).data;
      const actions = new Set(log.map((l) => l.action));
      for (const a of ['order.status', 'order.assign_rider', 'inventory.set', 'product.create', 'product.update']) {
        assert.ok(actions.has(a), `missing ${a}`);
      }
      assert.ok(log.every((l) => l.user_name === 'Admin'));
      assert.ok(log[0].id > log.at(-1).id, 'newest first');
    });
  });
});
