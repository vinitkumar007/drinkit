// Customer app entry: boots state, then a tiny hash router renders one page at a time.
import { mount } from '../shared/dom.js';
import { loading, errorState } from '../shared/ui.js';
import { state, loadUser, refreshStore } from './state.js';
import { renderHeader, login } from './components/header.js';
import { renderCartBar } from './components/cartBar.js';
import { renderLocation } from './pages/location.js';
import { renderShop } from './pages/shop.js';
import { renderOrders } from './pages/orders.js';
import { renderOrder } from './pages/order.js';
import { renderAccount } from './pages/account.js';

const root = document.getElementById('app');
let cleanup = null;

const routes = [
  { re: /^\/$/, needsStore: true, view: () => renderShop(root) },
  { re: /^\/orders$/, auth: true, view: () => renderOrders(root) },
  { re: /^\/order\/(\d+)$/, auth: true, view: (m) => renderOrder(root, m[1]) },
  { re: /^\/account$/, auth: true, view: () => renderAccount(root) },
];

async function route() {
  if (cleanup) { cleanup(); cleanup = null; }
  renderCartBar(null);
  renderHeader();
  window.scrollTo(0, 0);

  const path = (location.hash || '#/').slice(1) || '/';
  const r = routes.find((x) => x.re.test(path)) || routes[0];

  if (r.auth && !state.user) {
    mount(root);
    const user = await login();
    if (!user) { location.hash = '#/'; return; }
    return route();
  }
  if (r.needsStore) {
    if (!state.loc) return renderLocation(root);
    if (!state.svc || !state.svc.serviceable) {
      return renderLocation(root, { unserviceable: state.svc ? state.svc.reason : 'Location check nahi ho pa raha.' });
    }
  }
  const out = await r.view(r.re.exec(path));
  if (typeof out === 'function') cleanup = out;
  root.focus({ preventScroll: true });
}

async function boot() {
  mount(root, loading());
  try {
    await loadUser();
    await refreshStore();
  } catch (e) {
    renderHeader();
    return mount(root, errorState(e.message, () => location.reload()));
  }
  renderHeader();
  route();
}

window.addEventListener('hashchange', route);
boot();
