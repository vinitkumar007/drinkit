const { badRequest, forbidden } = require('../lib/errors');

function ageFromDob(dob, now = new Date()) {
  if (typeof dob !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) return null;
  const d = new Date(dob);
  if (isNaN(d) || d > now) return null;
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

// Throws 403 if the user is below the legal age for the given state rule.
function assertLegalAge(dob, state, minAge) {
  const age = ageFromDob(dob);
  if (age === null) throw badRequest('Valid date of birth daalo (YYYY-MM-DD)');
  if (age < minAge) throw forbidden(`${state} me alcohol kharidne ki minimum umar ${minAge} saal hai.`);
  return age;
}

module.exports = { ageFromDob, assertLegalAge };
