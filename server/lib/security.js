// cors / security headers / rate limiting.
const cors = () => (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  next();
};

const helmet = () => (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  // No inline scripts anywhere in the apps, so scripts are locked to our own origin.
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'self'");
  next();
};

function rateLimit({ windowMs, max }) {
  const hits = new Map();
  setInterval(() => hits.clear(), windowMs).unref();
  return (req, res, next) => {
    const ip = req.socket.remoteAddress || 'x';
    const n = (hits.get(ip) || 0) + 1;
    hits.set(ip, n);
    if (n > max) return res.status(429).json({ error: 'Bahut zyada requests, thodi der baad try karo' });
    next();
  };
}

module.exports = { cors, helmet, rateLimit };
