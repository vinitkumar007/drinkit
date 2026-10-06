// Small input validators. All throw 400 HttpErrors with user-friendly (Hinglish) messages.
const { badRequest } = require('./errors');

function str(v, { name = 'Value', min = 1, max = 300 } = {}) {
  const s = typeof v === 'string' ? v.trim() : '';
  if (s.length < min) throw badRequest(`${name} zaroori hai`);
  if (s.length > max) throw badRequest(`${name} bahut lamba hai`);
  return s;
}

function optStr(v, opts = {}) {
  if (v === undefined || v === null || v === '') return null;
  return str(v, { min: 0, ...opts });
}

function int(v, { name = 'Value', min = 0, max = 1e9 } = {}) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw badRequest(`${name} ${min} se ${max} ke beech integer hona chahiye`);
  return n;
}

function num(v, { name = 'Value', min = -1e9, max = 1e9 } = {}) {
  const n = Number(v);
  if (v === null || v === '' || !Number.isFinite(n) || n < min || n > max) throw badRequest(`${name} sahi number hona chahiye`);
  return n;
}

function phone(v) {
  const p = String(v || '').replace(/\D/g, '').slice(-10);
  if (!/^[6-9]\d{9}$/.test(p)) throw badRequest('Valid 10 digit mobile number daalo');
  return p;
}

function oneOf(v, list, name = 'Value') {
  if (!list.includes(v)) throw badRequest(`${name} in me se hona chahiye: ${list.join(', ')}`);
  return v;
}

function lat(v) { return num(v, { name: 'Latitude', min: -90, max: 90 }); }
function lng(v) { return num(v, { name: 'Longitude', min: -180, max: 180 }); }

module.exports = { str, optStr, int, num, phone, oneOf, lat, lng };
