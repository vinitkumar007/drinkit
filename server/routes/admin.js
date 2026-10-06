const { validate: v } = require('../lib');
const { authenticate, requireRole } = require('../middleware/auth');
const orders = require('../services/orders');
const admin = require('../services/admin');
const audit = require('../services/audit');

module.exports = (app) => {
  const guard = [authenticate, requireRole('admin')];
  const oid = (req) => v.int(req.params.id, { name: 'Order', min: 1 });

  app.get('/api/admin/stats', ...guard, (req, res) => res.json(admin.stats()));
  app.get('/api/admin/stores', ...guard, (req, res) => res.json(admin.stores()));
  app.get('/api/admin/riders', ...guard, (req, res) => res.json(admin.riders()));
  app.get('/api/admin/audit', ...guard, (req, res) => res.json(audit.recent(100)));

  // orders
  app.get('/api/admin/orders', ...guard, (req, res) => res.json(orders.adminList({ status: req.query.status || undefined })));
  app.patch('/api/admin/orders/:id/status', ...guard, (req, res) => res.json(orders.adminSetStatus(req.user, oid(req), req.body.status)));
  app.post('/api/admin/orders/:id/assign', ...guard, (req, res) => res.json(orders.adminAssignRider(req.user, oid(req), req.body.rider_id)));

  // inventory
  app.get('/api/admin/inventory', ...guard, (req, res) => res.json(admin.inventory(req.query.store_id)));
  app.patch('/api/admin/inventory', ...guard, (req, res) => { admin.setStock(req.user, req.body); res.json({ ok: true }); });

  // products
  app.get('/api/admin/products', ...guard, (req, res) => res.json(admin.products()));
  app.post('/api/admin/products', ...guard, (req, res) => res.status(201).json(admin.createProduct(req.user, req.body)));
  app.patch('/api/admin/products/:id', ...guard, (req, res) => { admin.updateProduct(req.user, req.params.id, req.body); res.json({ ok: true }); });

  // coupons
  app.get('/api/admin/coupons', ...guard, (req, res) => res.json(admin.listCoupons()));
  app.post('/api/admin/coupons', ...guard, (req, res) => res.status(201).json(admin.createCoupon(req.user, req.body)));
  app.patch('/api/admin/coupons/:code', ...guard, (req, res) => { admin.setCouponActive(req.user, req.params.code, !!req.body.active); res.json({ ok: true }); });
};
