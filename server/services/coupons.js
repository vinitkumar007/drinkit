const db = require('../db');
const { badRequest } = require('../lib/errors');

// Returns { code, discount } for a valid coupon, or throws a 400 explaining why not.
function quote(codeRaw, subtotal, now = new Date()) {
  const code = String(codeRaw || '').trim().toUpperCase();
  const c = db.prepare('SELECT * FROM coupons WHERE code = ?').get(code);
  if (!c || !c.active) throw badRequest('Ye coupon valid nahi hai');
  if (c.expires_at && new Date(c.expires_at) < now) throw badRequest('Ye coupon expire ho gaya');
  if (subtotal < c.min_subtotal) throw badRequest(`Is coupon ke liye minimum ₹${c.min_subtotal} ka order chahiye`);

  let discount = c.type === 'flat' ? c.value : Math.floor((subtotal * c.value) / 100);
  if (c.max_discount != null) discount = Math.min(discount, c.max_discount);
  discount = Math.max(0, Math.min(discount, subtotal));
  return { code: c.code, discount };
}

module.exports = { quote };
