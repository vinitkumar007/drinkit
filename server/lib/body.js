// JSON body parser with a size limit.
function json({ limit = 100 * 1024 } = {}) {
  return (req, res, next) => {
    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) return next();
    let size = 0;
    let dead = false;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit && !dead) {
        dead = true;
        res.status(413).json({ error: 'Body too large' });
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (dead) return;
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return next();
      try { req.body = JSON.parse(raw); } catch { return res.status(400).json({ error: 'Invalid JSON' }); }
      next();
    });
  };
}

module.exports = { json };
