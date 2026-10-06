// Pure unit tests: no server/database needed.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('../lib/jwt');
const validate = require('../lib/validate');
const { ageFromDob, assertLegalAge } = require('../services/age');
const { haversineKm } = require('../services/geo');

describe('jwt', () => {
  it('round-trips a payload', () => {
    const t = jwt.sign({ id: 7 }, 's3cret', { expiresIn: '1h' });
    assert.equal(jwt.verify(t, 's3cret').id, 7);
  });
  it('rejects a wrong secret', () => {
    const t = jwt.sign({ id: 7 }, 'a');
    assert.throws(() => jwt.verify(t, 'b'));
  });
  it('rejects a tampered payload', () => {
    const [h, , s] = jwt.sign({ id: 7 }, 'k').split('.');
    const forged = Buffer.from(JSON.stringify({ id: 1, exp: 9999999999 })).toString('base64url');
    assert.throws(() => jwt.verify(`${h}.${forged}.${s}`, 'k'));
  });
  it('rejects an expired token', () => {
    const t = jwt.sign({ id: 1 }, 'k', { expiresIn: '1s' });
    const realNow = Date.now;
    Date.now = () => realNow() + 5000;
    try { assert.throws(() => jwt.verify(t, 'k'), /expired/); } finally { Date.now = realNow; }
  });
});

describe('age', () => {
  const now = new Date('2026-10-05T10:00:00Z');
  it('computes age around a birthday', () => {
    assert.equal(ageFromDob('2001-10-05', now), 25);
    assert.equal(ageFromDob('2001-10-06', now), 24);
  });
  it('rejects garbage and future dates', () => {
    assert.equal(ageFromDob('not-a-date', now), null);
    assert.equal(ageFromDob('2030-01-01', now), null);
    assert.equal(ageFromDob(undefined, now), null);
  });
  it('enforces the minimum age', () => {
    assert.throws(() => assertLegalAge('2012-01-01', 'Delhi', 25), /25/);
    assert.ok(assertLegalAge('1990-01-01', 'Delhi', 25) >= 25);
  });
});

describe('geo', () => {
  it('Delhi -> Jaipur is about 235 km', () => {
    const d = haversineKm(28.6139, 77.209, 26.9124, 75.7873);
    assert.ok(d > 225 && d < 245, `got ${d}`);
  });
  it('same point is zero', () => assert.equal(haversineKm(1, 1, 1, 1), 0));
});

describe('validate', () => {
  it('phone: accepts +91 formats and rejects short/invalid numbers', () => {
    assert.equal(validate.phone('+91 98765 43210'), '9876543210');
    assert.throws(() => validate.phone('12345'));
    assert.throws(() => validate.phone('5876543210'));
  });
  it('int / str / oneOf', () => {
    assert.equal(validate.int('5', { min: 1, max: 10 }), 5);
    assert.throws(() => validate.int(1.5));
    assert.throws(() => validate.int(11, { max: 10 }));
    assert.throws(() => validate.str('   ', { name: 'X' }));
    assert.throws(() => validate.oneOf('z', ['a', 'b']));
  });
  it('lat/lng bounds', () => {
    assert.equal(validate.lat('28.6'), 28.6);
    assert.throws(() => validate.lat(100));
    assert.throws(() => validate.lng('abc'));
    assert.throws(() => validate.lng(null));
  });
});
