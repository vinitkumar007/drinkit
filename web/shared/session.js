// Login session (token + user) kept in localStorage when available, in memory otherwise.
// Each app uses its own storage key so an admin login never leaks into the customer app.
export function createSession(key) {
  const mem = {};
  const read = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return mem[k] ?? null; } };
  const write = (k, v) => {
    mem[k] = v;
    try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ }
  };

  const listeners = new Set();
  const s = {
    token: read(key + '.token'),
    user: null,
    set(token, user) { s.token = token; s.user = user; write(key + '.token', token); listeners.forEach((f) => f(s)); },
    clear() { s.set(null, null); },
    expire() { s.clear(); },
    onChange(fn) { listeners.add(fn); },
    // small per-app preferences (location, cart ...)
    load: (k) => read(key + '.' + k),
    save: (k, v) => write(key + '.' + k, v),
  };
  return s;
}
