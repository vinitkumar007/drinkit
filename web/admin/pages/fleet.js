import { h, mount } from '../../shared/dom.js';
import { loading, errorState } from '../../shared/ui.js';
import { api } from '../state.js';

const table = (heads, rows) => h('div', { class: 'card flush' }, h('div', { class: 'table-wrap' }, h('table', null,
  h('thead', null, h('tr', null, heads.map((t) => h('th', null, t)))), h('tbody', null, rows))));

export async function fleetPage(root) {
  mount(root, loading());
  let riders, stores;
  try { [riders, stores] = await Promise.all([api.get('/admin/riders'), api.get('/admin/stores')]); }
  catch (e) { return mount(root, errorState(e.message, () => fleetPage(root))); }

  mount(root,
    h('h1', null, 'Stores and riders'),
    h('h2', { style: { margin: '18px 0 10px' } }, 'Stores'),
    table(['Store', 'State', 'Licence', 'Min age', 'Hours', 'Radius'],
      stores.map((s) => h('tr', null, h('td', null, h('b', null, s.name)), h('td', null, s.state), h('td', { class: 'muted' }, s.license_no),
        h('td', null, `${s.min_age}+`), h('td', { class: 'num' }, `${s.open_hour}:00 - ${s.close_hour}:00`), h('td', { class: 'num' }, `${s.radius_km} km`)))),
    h('h2', { style: { margin: '24px 0 10px' } }, 'Riders'),
    table(['Rider', 'Phone', 'Store', 'Active jobs', 'Delivered', 'Status'],
      riders.map((r) => h('tr', null, h('td', null, h('b', null, r.name)), h('td', { class: 'num' }, r.phone), h('td', null, r.store),
        h('td', { class: 'num' }, String(r.active_jobs)), h('td', { class: 'num' }, String(r.delivered)),
        h('td', null, h('span', { class: 'badge ' + (r.available ? 'on' : 'off') }, r.available ? 'Available' : 'Offline'))))));
}
