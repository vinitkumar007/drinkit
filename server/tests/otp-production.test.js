// Production behaviour with DEMO_OTP=1: customers can see their OTP, staff never can.
process.env.NODE_ENV = 'production';
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret';
process.env.DEMO_OTP = '1';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helpers');

describe('OTP exposure in production + DEMO_OTP', () => {
  let ctx;
  before(async () => { ctx = await startServer(); });
  after(() => ctx.close());

  it('shows the OTP to customers so demos work without SMS', async () => {
    const r = await ctx.api('POST', '/api/auth/request-otp', { phone: '9555555510' });
    assert.match(r.data.dev_otp, /^\d{6}$/);
  });

  it('never shows the OTP for admin or rider numbers', async () => {
    for (const phone of ['9000000001', '9000000002']) {
      const r = await ctx.api('POST', '/api/auth/request-otp', { phone });
      assert.equal(r.status, 200);
      assert.equal(r.data.dev_otp, undefined, phone);
    }
  });
});
