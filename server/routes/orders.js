const { validate: v } = require('../lib');
const { authenticate } = require('../middleware/auth');
const orders = require('../services/orders');

const id = (req) => v.int(req.params.id, { name: 'Order', min: 1 });

module.exports = (app) => {
  app.post('/api/orders', authenticate, (req, res) => res.status(201).json(orders.placeOrder(req.user, req.body)));

  app.get('/api/orders', authenticate, (req, res) => res.json(orders.listForUser(req.user)));

  app.get('/api/orders/:id', authenticate, (req, res) => res.json(orders.getForViewer(req.user, id(req))));

  app.post('/api/orders/:id/cancel', authenticate, (req, res) => res.json(orders.cancelByCustomer(req.user, id(req))));
};
