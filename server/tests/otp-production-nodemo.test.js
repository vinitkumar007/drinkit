// Production without DEMO_OTP: nobody ever gets an OTP in the response.
process.env.NODE_ENV = 'production';
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret';
delete process.env.DEMO_OTP;
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helpers');

describe('OTP exposure in plain production', () => {
  let ctx;
  before(async () => { ctx = await startServer(); });
  after(() => ctx.close());

  it('never returns the OTP', async () => {
    const r = await ctx.api('POST', '/api/auth/request-otp', { phone: '9555555520' });
    assert.equal(r.status, 200);
    assert.equal(r.data.dev_otp, undefined);
  });
});
