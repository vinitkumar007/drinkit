const crypto = require('crypto');
const db = require('../db');
const config = require('../config');
const { jwt, validate: v, errors } = require('../lib');
const { assertLegalAge } = require('./age');

const publicUser = (u) => ({ id: u.id, phone: u.phone, name: u.name, role: u.role, age_verified: !!u.age_verified });

function requestOtp(phoneRaw) {
  const phone = v.phone(phoneRaw);
  // Who may see the OTP in the response? Everyone in dev/test. In production only customers, and only in DEMO_OTP mode.
  const existing = db.prepare('SELECT role FROM users WHERE phone = ?').get(phone);
  const isStaff = !!existing && existing.role !== 'customer';
  const expose = config.otp.exposeInResponse || (config.demoOtp && !isStaff);
  const code = String(crypto.randomInt(100000, 1000000));
  db.prepare(`INSERT INTO otps (phone, code, expires_at, attempts) VALUES (?,?,?,0)
    ON CONFLICT(phone) DO UPDATE SET code=excluded.code, expires_at=excluded.expires_at, attempts=0`)
    .run(phone, code, Date.now() + config.otp.ttlMs);
  // TODO(production): send via an SMS provider (MSG91 / Twilio / Gupshup).
  if (expose) console.log(`[DEV OTP] ${phone}: ${code}`);
  return expose ? { ok: true, dev_otp: code } : { ok: true };
}

// ----- staff password login (admin / rider) -----
const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  return `scrypt$${salt}$${crypto.scryptSync(password, salt, 64).toString('hex')}`;
};
function verifyPassword(password, stored) {
  const [scheme, salt, hash] = String(stored || '').split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const given = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

function staffLogin(phoneRaw, passwordRaw) {
  const phone = v.phone(phoneRaw);
  const password = String(passwordRaw || '');
  const user = db.prepare("SELECT * FROM users WHERE phone = ? AND role IN ('admin','rider')").get(phone);
  // Hash even for unknown numbers so response time does not reveal which numbers are staff.
  const ok = verifyPassword(password, user ? user.password_hash : hashPassword('x'));
  if (!user || !ok) throw errors.unauthorized('Number ya password galat hai');
  const token = jwt.sign({ id: user.id }, config.jwtSecret, { expiresIn: config.jwtExpiry });
  return { token, user: publicUser(user) };
}

// STAFF_PASSWORD in the environment is the source of truth for all admin/rider passwords.
function applyStaffPasswordFromEnv() {
  const pw = config.staffPassword;
  if (!pw) return { applied: 0 };
  if (pw.length < 8) { console.warn('STAFF_PASSWORD ignored: it must be at least 8 characters.'); return { applied: 0 }; }
  let applied = 0;
  for (const u of db.prepare("SELECT id, password_hash FROM users WHERE role IN ('admin','rider')").all()) {
    if (!verifyPassword(pw, u.password_hash)) {
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(pw), u.id);
      applied++;
    }
  }
  return { applied };
}

function verifyOtp(phoneRaw, otpRaw, nameRaw) {
  const phone = v.phone(phoneRaw);
  const otp = String(otpRaw || '');
  const row = db.prepare('SELECT * FROM otps WHERE phone = ?').get(phone);
  if (!row || row.expires_at < Date.now()) throw errors.badRequest('OTP expire ho gaya, dubara bhejo');
  if (row.attempts >= config.otp.maxAttempts) throw errors.tooMany('Bahut zyada galat attempts. Naya OTP lo.');
  if (row.code !== otp) {
    db.prepare('UPDATE otps SET attempts = attempts + 1 WHERE phone = ?').run(phone);
    throw errors.badRequest('Galat OTP');
  }
  db.prepare('DELETE FROM otps WHERE phone = ?').run(phone);

  let user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
  if (!user) {
    const name = v.optStr(nameRaw, { max: 60 });
    const id = db.prepare('INSERT INTO users (phone, name) VALUES (?,?)').run(phone, name).lastInsertRowid;
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  }
  const token = jwt.sign({ id: user.id }, config.jwtSecret, { expiresIn: config.jwtExpiry });
  return { token, user: publicUser(user) };
}

// Self-declared DOB. The rider ALSO checks physical ID at the doorstep.
// For production add a KYC provider (DigiLocker / Aadhaar eKYC via a licensed partner).
function setAge(user, dob, state) {
  const rule = db.prepare('SELECT * FROM state_rules WHERE state = ?').get(state);
  if (!rule) throw errors.badRequest('State supported nahi hai');
  assertLegalAge(dob, state, rule.min_age);
  db.prepare('UPDATE users SET dob = ?, age_verified = 1 WHERE id = ?').run(dob, user.id);
}

function updateProfile(user, nameRaw) {
  const name = v.str(nameRaw, { name: 'Naam', max: 60 });
  db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, user.id);
  return publicUser({ ...user, name });
}

module.exports = { requestOtp, verifyOtp, staffLogin, applyStaffPasswordFromEnv, hashPassword, setAge, updateProfile, publicUser };
