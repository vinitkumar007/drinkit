// Static file server for the web apps (supports directory index.html, blocks path traversal).
const fs = require('fs');
const path = require('path');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json',
};

function serveStatic(root) {
  const base = path.resolve(root);
  return (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (req.path.startsWith('/api')) return next();
    const file = path.resolve(path.join(base, req.path));
    if (file !== base && !file.startsWith(base + path.sep)) return next(); // ../ traversal

    fs.stat(file, (err, st) => {
      if (err) return next();
      if (st.isDirectory()) {
        if (!req.path.endsWith('/')) return res.redirect(301, req.path + '/');
        return send(path.join(file, 'index.html'), res, next);
      }
      send(file, res, next);
    });
  };
}

function send(file, res, next) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return next();
    res.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-cache');
    fs.createReadStream(file).pipe(res);
  });
}

module.exports = { serveStatic };
