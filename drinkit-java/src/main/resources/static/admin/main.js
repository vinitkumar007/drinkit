// Admin console entry: login gate, sidebar layout, hash router.
import { h, mount } from '../shared/dom.js';
import { loginFlow } from '../shared/login.js';
import { api, session } from './state.js';
import { dashboardPage } from './pages/dashboard.js';
import { ordersPage } from './pages/orders.js';
import { inventoryPage } from './pages/inventory.js';
import { productsPage } from './pages/products.js';
import { couponsPage } from './pages/coupons.js';
import { fleetPage } from './pages/fleet.js';
import { auditPage } from './pages/audit.js';

const shell = document.getElementById('shell');
const PAGES = [
  ['dashboard', 'Overview', dashboardPage],
  ['orders', 'Orders', ordersPage],
  ['inventory', 'Inventory', inventoryPage],
  ['products', 'Products', productsPage],
  ['coupons', 'Coupons', couponsPage],
  ['fleet', 'Stores and riders', fleetPage],
  ['audit', 'Audit log', auditPage],
];

let user = null;
let cleanup = null;

function currentKey() {
  const k = (location.hash || '#/dashboard').replace(/^#\//, '');
  return PAGES.some((p) => p[0] === k) ? k : 'dashboard';
}

function layout() {
  const key = currentKey();
  const main = h('main', { class: 'content', tabindex: '-1' });
  mount(shell, h('div', { class: 'layout' },
    h('aside', { class: 'side' },
      h('div', { class: 'brand' }, h('b', null, 'drinkit'), h('span', null, 'admin')),
      h('nav', { 'aria-label': 'Admin' }, PAGES.map(([k, label]) =>
        h('a', { href: '#/' + k, 'aria-current': k === key ? 'page' : null }, label))),
      h('div', { class: 'who' },
        h('div', { class: 'small' }, user.name || user.phone),
        h('button', { class: 'btn ghost sm', type: 'button', onclick: () => { session.clear(); location.reload(); } }, 'Log out'))),
    main));
  return { main, key };
}

function route() {
  if (cleanup) { cleanup(); cleanup = null; }
  const { main, key } = layout();
  const out = PAGES.find((p) => p[0] === key)[2](main);
  Promise.resolve(out).then((fn) => { if (typeof fn === 'function') cleanup = fn; });
}

function gate(message) {
  mount(shell, h('div', { class: 'gate' },
    h('h1', null, 'Drinkit admin'),
    h('p', { class: 'muted' }, message || 'Sirf staff ke liye. Admin number se login karo.'),
    h('button', { class: 'btn', type: 'button', onclick: start }, 'Log in')));
}

async function start() {
  if (!session.token) {
    const u = await loginFlow({ api, session, title: 'Admin login', allowedRoles: ['admin'], method: 'password', intro: 'Admin mobile number aur password daalo.' });
    if (!u) return gate();
  }
  try {
    user = (await api.get('/me')).user;
    if (user.role !== 'admin') { session.clear(); return gate('Ye account admin nahi hai.'); }
  } catch { session.clear(); return gate('Session expire ho gaya. Dobara login karo.'); }
  route();
}

window.addEventListener('hashchange', () => { if (user) route(); });
session.onChange((s) => { if (!s.token && user) { user = null; gate('Session expire ho gaya. Dobara login karo.'); } });
start();
