const config = require('../config');
const { rateLimit, validate: v } = require('../lib');
const { authenticate } = require('../middleware/auth');
const auth = require('../services/auth');

module.exports = (app) => {
  const limiter = rateLimit({ windowMs: config.rateLimit.authWindowMs, max: config.rateLimit.authMax });

  const staffLimiter = rateLimit({ windowMs: config.rateLimit.authWindowMs, max: config.rateLimit.staffMax });

  // Admin / rider login with phone + password (no SMS needed).
  app.post('/api/auth/staff-login', staffLimiter, (req, res) => res.json(auth.staffLogin(req.body.phone, req.body.password)));

  app.post('/api/auth/request-otp', limiter, (req, res) => res.json(auth.requestOtp(req.body.phone)));

  app.post('/api/auth/verify-otp', limiter, (req, res) =>
    res.json(auth.verifyOtp(req.body.phone, req.body.otp, req.body.name)));

  app.get('/api/me', authenticate, (req, res) => res.json({ user: auth.publicUser(req.user) }));

  app.patch('/api/me', authenticate, (req, res) => res.json({ user: auth.updateProfile(req.user, req.body.name) }));

  // Age gate (self-declared DOB; rider also checks physical ID at the doorstep).
  app.post('/api/auth/age', authenticate, (req, res) => {
    auth.setAge(req.user, req.body.dob, v.str(req.body.state, { name: 'State', max: 40 }));
    res.json({ ok: true });
  });
};
