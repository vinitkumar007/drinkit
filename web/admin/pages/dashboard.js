import { h, mount, rupee } from '../../shared/dom.js';
import { loading, errorState, STATUS_LABEL } from '../../shared/ui.js';
import { api } from '../state.js';

const stat = (label, value, sub) => h('div', { class: 'card stat' },
  h('div', { class: 'muted small' }, label), h('div', { class: 'stat-n num' }, value), sub && h('div', { class: 'muted small' }, sub));

export async function dashboardPage(root) {
  mount(root, loading());
  let s;
  try { s = await api.get('/admin/stats'); } catch (e) { return mount(root, errorState(e.message, () => dashboardPage(root))); }

  const order = ['placed', 'accepted', 'packed', 'out_for_delivery', 'delivered', 'cancelled'];
  const max = Math.max(1, ...order.map((k) => s.by_status[k] || 0));

  mount(root,
    h('h1', null, 'Overview'),
    h('div', { class: 'stats' },
      stat('Open orders', String(s.open_orders), 'Abhi process ho rahe'),
      stat("Today's orders", String(s.today.orders), rupee(s.today.revenue)),
      stat('All-time orders', String(s.orders)),
      stat('All-time revenue', rupee(s.revenue), 'Cancelled orders ko chhod kar')),
    h('div', { class: 'two' },
      h('section', { class: 'card' },
        h('h3', null, 'Orders by status'),
        h('div', { class: 'bars' }, order.map((k) => h('div', { class: 'bar-row' },
          h('span', { class: 'small' }, STATUS_LABEL[k]),
          h('div', { class: 'bar' }, h('i', { class: k, style: { width: `${((s.by_status[k] || 0) / max) * 100}%` } })),
          h('b', { class: 'num small' }, String(s.by_status[k] || 0)))))),
      h('section', { class: 'card' },
        h('h3', null, 'Top sellers'),
        s.top_products.length
          ? s.top_products.map((p) => h('div', { class: 'line' }, h('span', null, p.name), h('b', { class: 'num' }, `${p.qty} sold`)))
          : h('p', { class: 'muted' }, 'Abhi koi sale nahi hui.'))),
    h('section', { class: 'card', style: { marginTop: '16px' } },
      h('div', { class: 'row between' }, h('h3', null, 'Low stock (5 or fewer)'), h('a', { class: 'btn ghost sm', href: '#/inventory' }, 'Manage stock')),
      s.low_stock.length
        ? h('div', { class: 'table-wrap' }, h('table', null,
          h('thead', null, h('tr', null, ['Store', 'Product', 'Left'].map((t) => h('th', null, t)))),
          h('tbody', null, s.low_stock.map((l) => h('tr', null, h('td', null, l.store), h('td', null, l.product),
            h('td', null, h('span', { class: 'badge ' + (l.stock === 0 ? 'cancelled' : 'placed') }, String(l.stock))))))))
        : h('p', { class: 'muted', style: { marginTop: '8px' } }, 'Sab products ka stock theek hai.')));
}
