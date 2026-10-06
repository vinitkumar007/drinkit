const { validate: v, errors } = require('../lib');
const { authenticate } = require('../middleware/auth');
const { findServiceableStore, publicStore } = require('../services/stores');
const catalog = require('../services/catalog');
const coupons = require('../services/coupons');

module.exports = (app) => {
  app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

  // Can we deliver to this location? Returns the serving store and ETA.
  app.get('/api/serviceability', (req, res) => {
    const r = findServiceableStore(v.lat(req.query.lat), v.lng(req.query.lng));
    res.json({ serviceable: r.ok, reason: r.reason, store: publicStore(r.store), eta_minutes: r.eta_minutes });
  });

  app.get('/api/categories', (req, res) => res.json(catalog.categories()));

  app.get('/api/products', (req, res) =>
    res.json(catalog.productsForStore(Number(req.query.store_id), { category: req.query.category, q: req.query.q })));

  // Preview a coupon against a cart subtotal. The real discount is recomputed when the order is placed.
  app.post('/api/coupons/validate', authenticate, (req, res) => {
    const subtotal = v.int(req.body.subtotal, { name: 'Subtotal', min: 0, max: 10000000 });
    if (!req.body.code) throw errors.badRequest('Coupon code daalo');
    res.json(coupons.quote(req.body.code, subtotal));
  });
};
