const db = require('../db');
const config = require('../config');
const { haversineKm } = require('./geo');

// Current hour in Indian time, regardless of where the server runs.
function istHour(now = new Date()) {
  return Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: config.timezone }).format(now)) % 24;
}

// Finds the nearest active store covering the location and checks delivery rules.
// Returns { ok, reason?, store?, eta_minutes? }.
function findServiceableStore(lat, lng, now = new Date()) {
  const stores = db.prepare(`
    SELECT s.*, r.min_age, r.delivery_allowed FROM stores s
    JOIN state_rules r ON r.state = s.state WHERE s.active = 1`).all();

  let best = null;
  for (const s of stores) {
    const dist = haversineKm(lat, lng, s.lat, s.lng);
    if (dist > s.radius_km) continue;
    if (!best || dist < best.distance_km) best = { ...s, distance_km: dist };
  }
  if (!best) return { ok: false, reason: 'Aapke area me abhi delivery available nahi hai.' };
  if (!best.delivery_allowed) return { ok: false, reason: `${best.state} me home delivery allowed nahi hai.` };

  const hour = istHour(now);
  if (!config.ignoreStoreHours && (hour < best.open_hour || hour >= best.close_hour)) {
    return { ok: false, reason: `Store ${best.open_hour}:00 se ${best.close_hour}:00 tak open hai.`, store: best };
  }
  const eta = Math.max(8, Math.round(6 + best.distance_km * 3));
  return { ok: true, store: best, eta_minutes: eta };
}

function publicStore(s) {
  return s && { id: s.id, name: s.name, state: s.state, min_age: s.min_age };
}

module.exports = { findServiceableStore, publicStore, istHour };
