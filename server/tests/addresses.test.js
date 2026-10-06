const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, PLACES } = require('./helpers');

describe('saved addresses', () => {
  let ctx, me, other;
  before(async () => {
    ctx = await startServer();
    me = await ctx.login('9555555551', 'Me');
    other = await ctx.login('9555555552', 'Other');
  });
  after(() => ctx.close());

  const create = (token, body) => ctx.api('POST', '/api/addresses', { label: 'Home', address: '221B Baker Street, Delhi', ...PLACES.CP, ...body }, token);

  it('requires login', async () => {
    assert.equal((await ctx.api('GET', '/api/addresses')).status, 401);
  });

  it('creates, lists and deletes an address', async () => {
    const c = await create(me, { label: 'Office' });
    assert.equal(c.status, 201);
    assert.equal(c.data.label, 'Office');
    const list = await ctx.api('GET', '/api/addresses', null, me);
    assert.equal(list.data.length, 1);
    assert.equal((await ctx.api('DELETE', `/api/addresses/${c.data.id}`, null, me)).status, 200);
    assert.equal((await ctx.api('GET', '/api/addresses', null, me)).data.length, 0);
  });

  it('keeps addresses private to their owner', async () => {
    const c = await create(me);
    assert.equal((await ctx.api('GET', '/api/addresses', null, other)).data.length, 0);
    assert.equal((await ctx.api('DELETE', `/api/addresses/${c.data.id}`, null, other)).status, 404);
    assert.equal((await ctx.api('GET', '/api/addresses', null, me)).data.length, 1);
  });

  it('validates input', async () => {
    assert.equal((await create(me, { address: 'short' })).status, 400);
    assert.equal((await create(me, { lat: 999 })).status, 400);
    assert.equal((await create(me, { lng: 'abc' })).status, 400);
    assert.equal((await create(me, { lat: undefined })).status, 400);
  });

  it('limits to 10 saved addresses', async () => {
    const t = await ctx.login('9555555553');
    for (let i = 0; i < 10; i++) assert.equal((await create(t, { label: `A${i}` })).status, 201);
    assert.equal((await create(t, { label: 'extra' })).status, 400);
  });
});
