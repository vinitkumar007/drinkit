// Minimal HS256 JWT (sign/verify) using Node crypto.
const crypto = require('crypto');

const b64u = (b) => Buffer.from(b).toString('base64url');

function sign(payload, secret, { expiresIn = '1d' } = {}) {
  const m = /^(\d+)([smhd])$/.exec(expiresIn);
  if (!m) throw new Error('bad expiresIn');
  const secs = Number(m[1]) * { s: 1, m: 60, h: 3600, d: 86400 }[m[2]];
  const body = { ...payload, exp: Math.floor(Date.now() / 1000) + secs };
  const head = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const data = `${head}.${b64u(JSON.stringify(body))}`;
  return `${data}.${crypto.createHmac('sha256', secret).update(data).digest('base64url')}`;
}

function verify(token, secret) {
  const parts = String(token).split('.');
  if (parts.length !== 3) throw new Error('bad token');
  const expected = crypto.createHmac('sha256', secret).update(`${parts[0]}.${parts[1]}`).digest();
  const given = Buffer.from(parts[2], 'base64url');
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) throw new Error('bad signature');
  const body = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  if (!body.exp || body.exp < Date.now() / 1000) throw new Error('expired');
  return body;
}

module.exports = { sign, verify };
