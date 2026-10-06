// Tiny Express-compatible app/router built on Node core (the npm registry is not reachable here).
// API shape matches Express, so swapping in real `express` later is a drop-in change.
const http = require('http');

function compile(p) {
  const keys = [];
  const src = p.replace(/\/:([A-Za-z_]+)/g, (_, k) => { keys.push(k); return '/([^/]+)'; });
  return { regex: new RegExp('^' + src + '/?$'), keys };
}

function createApp() {
  const layers = [];

  const addUse = (prefix, fn) => layers.push({ method: null, prefix, fn });
  const addRoute = (method, p, fns) => {
    const m = compile(p);
    fns.forEach((fn) => layers.push({ method, regex: m.regex, keys: m.keys, fn }));
  };

  function handle(req, res) {
    const u = new URL(req.url, 'http://x');
    try { req.path = decodeURIComponent(u.pathname); } catch { req.path = u.pathname; }
    req.query = Object.fromEntries(u.searchParams);
    req.params = {};
    req.body = {};
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (obj) => {
      if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(obj));
    };
    res.redirect = (code, to) => { res.statusCode = code; res.setHeader('Location', to); res.end(); };

    let i = 0;
    const next = (err) => {
      while (i < layers.length) {
        const l = layers[i++];
        const isErrHandler = l.fn.length === 4;
        if (err && !isErrHandler) continue;
        if (!err && isErrHandler) continue;
        if (l.method === null) {
          const p = l.prefix;
          if (!(p === '/' || req.path === p || req.path.startsWith(p + '/'))) continue;
        } else {
          if (l.method !== req.method) continue;
          const m = l.regex.exec(req.path);
          if (!m) continue;
          req.params = {};
          l.keys.forEach((k, idx) => (req.params[k] = decodeURIComponent(m[idx + 1])));
        }
        try {
          const out = err ? l.fn(err, req, res, next) : l.fn(req, res, next);
          if (out && typeof out.catch === 'function') out.catch(next); // async handlers
          return;
        } catch (e) {
          return next(e);
        }
      }
      if (!res.headersSent) {
        if (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
        else res.status(404).json({ error: 'Not found' });
      }
    };
    next();
  }

  const app = (req, res) => handle(req, res);
  app.use = (a, ...rest) => {
    if (typeof a === 'string') rest.forEach((fn) => addUse(a, fn));
    else [a, ...rest].forEach((fn) => addUse('/', fn));
  };
  ['get', 'post', 'patch', 'put', 'delete'].forEach((m) => {
    app[m] = (p, ...fns) => addRoute(m.toUpperCase(), p, fns);
  });
  app.listen = (port, cb) => http.createServer(app).listen(port, cb);
  return app;
}

module.exports = { createApp };
