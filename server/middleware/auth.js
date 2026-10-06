const db = require('../db');
const config = require('../config');
const { jwt, errors } = require('../lib');

// Requires a valid Bearer token and loads req.user.
function authenticate(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) throw errors.unauthorized();
  let payload;
  try { payload = jwt.verify(token, config.jwtSecret); }
  catch { throw errors.unauthorized('Invalid or expired token'); }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.id);
  if (!user) throw errors.unauthorized('User not found');
  req.user = user;
  next();
}

// Use after authenticate: requireRole('admin'), requireRole('rider', 'admin')
const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) throw errors.forbidden();
  next();
};

module.exports = { authenticate, requireRole };
