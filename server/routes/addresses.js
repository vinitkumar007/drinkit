const { validate: v } = require('../lib');
const { authenticate } = require('../middleware/auth');
const addresses = require('../services/addresses');

module.exports = (app) => {
  app.get('/api/addresses', authenticate, (req, res) => res.json(addresses.list(req.user.id)));

  app.post('/api/addresses', authenticate, (req, res) => res.status(201).json(addresses.create(req.user.id, req.body)));

  app.delete('/api/addresses/:id', authenticate, (req, res) => {
    addresses.remove(req.user.id, v.int(req.params.id, { name: 'Address', min: 1 }));
    res.json({ ok: true });
  });
};
