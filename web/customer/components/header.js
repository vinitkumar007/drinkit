import { h, mount } from '../../shared/dom.js';
import { state, session, loadUser } from '../state.js';
import { loginFlow } from '../../shared/login.js';
import { api } from '../state.js';

export async function login(after) {
  const user = await loginFlow({ api, session, askName: true, title: 'Log in to Drinkit' });
  if (user) { await loadUser(); renderHeader(); if (after) after(); }
  return user;
}

export function renderHeader() {
  const root = document.getElementById('header-root');
  const eta = state.svc && state.svc.serviceable ? state.svc.eta_minutes : null;
  const here = (hash) => (location.hash || '#/') === hash;

  mount(root, h('header', { class: 'top' },
    h('div', { class: 'top-in' },
      h('a', { class: 'logo', href: '#/', 'aria-label': 'Drinkit home' }, 'drinkit'),
      eta !== null && h('div', { class: 'seal', title: `Aapke area me delivery ~${eta} minute` },
        h('b', null, String(eta)), h('span', null, 'min')),
      h('nav', { class: 'nav', 'aria-label': 'Main' },
        h('a', { href: '#/', 'aria-current': here('#/') ? 'page' : null }, 'Shop'),
        state.user && h('a', { href: '#/orders', 'aria-current': here('#/orders') ? 'page' : null }, 'Orders'),
        state.user
          ? h('a', { href: '#/account', 'aria-current': here('#/account') ? 'page' : null }, state.user.name ? state.user.name.split(' ')[0] : 'Account')
          : h('button', { class: 'btn sm', type: 'button', onclick: () => login(() => location.reload()) }, 'Log in')))));
}
