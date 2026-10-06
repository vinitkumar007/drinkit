process.env.STAFF_PASSWORD = 'correct-horse-9';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helpers');

describe('staff password login', () => {
  let ctx;
  before(async () => { ctx = await startServer(); });
  after(() => ctx.close());
  const login = (phone, password) => ctx.api('POST', '/api/auth/staff-login', { phone, password });

  it('lets admin and rider in with the shared password, no OTP needed', async () => {
    const a = await login('9000000001', 'correct-horse-9');
    assert.equal(a.status, 200);
    assert.equal(a.data.user.role, 'admin');
    assert.equal((await ctx.api('GET', '/api/admin/stats', null, a.data.token)).status, 200);
    const r = await login('9000000002', 'correct-horse-9');
    assert.equal(r.data.user.role, 'rider');
    assert.equal((await ctx.api('GET', '/api/rider/me', null, r.data.token)).status, 200);
  });

  it('rejects a wrong or missing password with a generic message', async () => {
    for (const body of [['9000000001', 'wrong-password'], ['9000000001', ''], ['9000000001', undefined]]) {
      const r = await login(...body);
      assert.equal(r.status, 401);
      assert.match(r.data.error, /galat/);
    }
  });

  it('does not work for customers or unknown numbers', async () => {
    await ctx.login('9555555500', 'Customer');
    assert.equal((await login('9555555500', 'correct-horse-9')).status, 401);
    assert.equal((await login('9555555501', 'correct-horse-9')).status, 401);
    assert.equal((await login('123', 'correct-horse-9')).status, 400);
  });
});
