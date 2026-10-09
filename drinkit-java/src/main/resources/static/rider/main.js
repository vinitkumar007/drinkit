// Rider app entry: login, availability toggle, live job list.
import { h, mount } from '../shared/dom.js';
import { loginFlow } from '../shared/login.js';
import { loading, emptyState, errorState, safe, toast } from '../shared/ui.js';
import { api, session } from './state.js';
import { jobCard } from './jobCard.js';

const shell = document.getElementById('shell');
let timer = null;
let busy = false; // do not refresh the list while the rider is typing an OTP

async function render() {
  clearTimeout(timer);
  let me, jobs;
  try { [me, jobs] = await Promise.all([api.get('/rider/me'), api.get('/rider/orders')]); }
  catch (e) { return mount(shell, header(null), h('main', { class: 'content' }, errorState(e.message, render))); }

  const toggle = safe(async (e) => {
    await api.patch('/rider/availability', { available: e.target.checked });
    toast(e.target.checked ? 'You are online. New orders will come to you.' : 'You are offline.');
  });

  mount(shell, header(me),
    h('main', { class: 'content' },
      h('div', { class: 'card status' },
        h('label', { class: 'check', style: { alignItems: 'center' } },
          h('input', { type: 'checkbox', checked: me.available, onchange: toggle, role: 'switch' }),
          h('span', null, h('b', null, 'Available for orders'), h('br'), h('span', { class: 'muted small' }, 'Offline hone par naye orders nahi milenge'))),
        h('div', { class: 'row', style: { marginTop: '12px', justifyContent: 'space-around' } },
          h('div', { class: 'center' }, h('div', { class: 'big num' }, String(me.active_jobs)), h('div', { class: 'muted small' }, 'Active')),
          h('div', { class: 'center' }, h('div', { class: 'big num' }, String(me.delivered)), h('div', { class: 'muted small' }, 'Delivered')))),
      h('h2', { style: { margin: '20px 0 10px' } }, 'Your deliveries'),
      jobs.length
        ? h('div', { class: 'stack' }, jobs.map((j) => jobCard(j, render)))
        : emptyState('No orders right now', 'Jaise hi store koi order pack karega, wo yaha dikhega.')));

  // Auto-refresh, but never wipe a form the rider is filling in.
  timer = setTimeout(() => { if (document.activeElement && document.activeElement.matches('input, select, textarea')) busy = true; else busy = false; if (busy) { timer = setTimeout(render, 8000); } else render(); }, 8000);
}

function header(me) {
  return h('header', { class: 'top' }, h('div', { class: 'top-in' },
    h('b', { class: 'logo' }, 'drinkit rider'),
    me && h('span', { class: 'store small' }, me.store),
    h('button', { class: 'btn ghost sm out', type: 'button', onclick: () => { session.clear(); location.reload(); } }, 'Log out')));
}

function gate(message) {
  mount(shell, h('div', { class: 'gate' },
    h('h1', null, 'Drinkit rider'),
    h('p', { class: 'muted' }, message || 'Rider number se login karo.'),
    h('button', { class: 'btn', type: 'button', onclick: start }, 'Log in')));
}

async function start() {
  if (!session.token) {
    const u = await loginFlow({ api, session, title: 'Rider login', allowedRoles: ['rider'], method: 'password', intro: 'Apna rider mobile number aur password daalo.' });
    if (!u) return gate();
  }
  mount(shell, loading());
  render();
}

session.onChange((s) => { if (!s.token) { clearTimeout(timer); gate('Session expire ho gaya. Dobara login karo.'); } });
start();
