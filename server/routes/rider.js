const { validate: v } = require('../lib');
const { authenticate, requireRole } = require('../middleware/auth');
const orders = require('../services/orders');

module.exports = (app) => {
  const guard = [authenticate, requireRole('rider')];
  const oid = (req) => v.int(req.params.id, { name: 'Order', min: 1 });

  app.get('/api/rider/me', ...guard, (req, res) => res.json(orders.riderProfile(req.user)));

  app.patch('/api/rider/availability', ...guard, (req, res) => {
    orders.riderSetAvailability(req.user, !!req.body.available);
    res.json({ ok: true });
  });

  app.get('/api/rider/orders', ...guard, (req, res) => res.json(orders.riderJobs(req.user)));

  app.post('/api/rider/orders/:id/pickup', ...guard, (req, res) => { orders.riderPickup(req.user, oid(req)); res.json({ ok: true }); });

  app.post('/api/rider/orders/:id/deliver', ...guard, (req, res) => { orders.riderDeliver(req.user, oid(req), req.body); res.json({ ok: true }); });

  app.post('/api/rider/orders/:id/refuse', ...guard, (req, res) => { orders.riderRefuse(req.user, oid(req), req.body.reason); res.json({ ok: true }); });
};
