const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, dobYearsAgo } = require('./helpers');

describe('auth + age gate', () => {
  let ctx;
  before(async () => { ctx = await startServer(); });
  after(() => ctx.close());

  it('rejects an invalid phone number', async () => {
    const r = await ctx.api('POST', '/api/auth/request-otp', { phone: '123' });
    assert.equal(r.status, 400);
  });

  it('logs in with a correct OTP and returns a token', async () => {
    const o = await ctx.api('POST', '/api/auth/request-otp', { phone: '9111111111' });
    assert.equal(o.status, 200);
    assert.match(o.data.dev_otp, /^\d{6}$/);
    const v = await ctx.api('POST', '/api/auth/verify-otp', { phone: '9111111111', otp: o.data.dev_otp, name: 'Amit' });
    assert.equal(v.status, 200);
    assert.ok(v.data.token);
    assert.equal(v.data.user.name, 'Amit');
    assert.equal(v.data.user.role, 'customer');
    assert.equal(v.data.user.age_verified, false);
  });

  it('rejects a wrong OTP, and the OTP cannot be reused', async () => {
    const o = await ctx.api('POST', '/api/auth/request-otp', { phone: '9111111112' });
    const bad = await ctx.api('POST', '/api/auth/verify-otp', { phone: '9111111112', otp: '000000' });
    assert.equal(bad.status, 400);
    const good = await ctx.api('POST', '/api/auth/verify-otp', { phone: '9111111112', otp: o.data.dev_otp });
    assert.equal(good.status, 200);
    const reuse = await ctx.api('POST', '/api/auth/verify-otp', { phone: '9111111112', otp: o.data.dev_otp });
    assert.equal(reuse.status, 400);
  });

  it('locks out after 5 wrong attempts, even with the right OTP', async () => {
    const o = await ctx.api('POST', '/api/auth/request-otp', { phone: '9111111113' });
    for (let i = 0; i < 5; i++) {
      const r = await ctx.api('POST', '/api/auth/verify-otp', { phone: '9111111113', otp: '111111' });
      assert.equal(r.status, 400);
    }
    const locked = await ctx.api('POST', '/api/auth/verify-otp', { phone: '9111111113', otp: o.data.dev_otp });
    assert.equal(locked.status, 429);
    // requesting a fresh OTP resets the counter
    const o2 = await ctx.api('POST', '/api/auth/request-otp', { phone: '9111111113' });
    const ok = await ctx.api('POST', '/api/auth/verify-otp', { phone: '9111111113', otp: o2.data.dev_otp });
    assert.equal(ok.status, 200);
  });

  it('protects /api/me and rejects bad or tampered tokens', async () => {
    assert.equal((await ctx.api('GET', '/api/me')).status, 401);
    assert.equal((await ctx.api('GET', '/api/me', null, 'garbage')).status, 401);
    const token = await ctx.login('9111111114', 'T');
    assert.equal((await ctx.api('GET', '/api/me', null, token)).status, 200);
    const [h, p, s] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ id: 1, exp: 9999999999 })).toString('base64url');
    assert.equal((await ctx.api('GET', '/api/me', null, `${h}.${forged}.${s}`)).status, 401);
  });

  it('lets a user update their name', async () => {
    const token = await ctx.login('9111111115');
    const r = await ctx.api('PATCH', '/api/me', { name: 'Rohit' }, token);
    assert.equal(r.status, 200);
    assert.equal(r.data.user.name, 'Rohit');
    assert.equal((await ctx.api('PATCH', '/api/me', { name: '' }, token)).status, 400);
  });

  it('blocks underage users', async () => {
    const token = await ctx.login('9222222221');
    const r = await ctx.api('POST', '/api/auth/age', { dob: dobYearsAgo(16), state: 'Karnataka' }, token);
    assert.equal(r.status, 403);
    assert.equal((await ctx.api('GET', '/api/me', null, token)).data.user.age_verified, false);
  });

  it('applies the state-specific age (22 is fine in Karnataka, not in Delhi)', async () => {
    const token = await ctx.login('9222222222');
    assert.equal((await ctx.api('POST', '/api/auth/age', { dob: dobYearsAgo(22), state: 'Delhi' }, token)).status, 403);
    assert.equal((await ctx.api('POST', '/api/auth/age', { dob: dobYearsAgo(22), state: 'Karnataka' }, token)).status, 200);
    assert.equal((await ctx.api('GET', '/api/me', null, token)).data.user.age_verified, true);
  });

  it('rejects unknown states and malformed dates', async () => {
    const token = await ctx.login('9222222223');
    assert.equal((await ctx.api('POST', '/api/auth/age', { dob: '1990-01-01', state: 'Atlantis' }, token)).status, 400);
    assert.equal((await ctx.api('POST', '/api/auth/age', { dob: '01/01/1990', state: 'Delhi' }, token)).status, 400);
    assert.equal((await ctx.api('POST', '/api/auth/age', { dob: '2999-01-01', state: 'Delhi' }, token)).status, 400);
  });
});
