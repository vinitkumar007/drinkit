import { h, mount, rupee, fmtTime } from '../../shared/dom.js';
import { badge, loading, emptyState, errorState } from '../../shared/ui.js';
import { api } from '../state.js';

export async function renderOrders(root) {
  mount(root, loading());
  let orders;
  try { orders = await api.get('/orders'); } catch (e) { return mount(root, errorState(e.message, () => renderOrders(root))); }

  mount(root,
    h('h1', null, 'Your orders'),
    orders.length
      ? h('div', { class: 'stack', style: { marginTop: '16px' } }, orders.map((o) =>
        h('a', { class: 'card order-row', href: '#/order/' + o.id },
          h('div', { class: 'row between' }, h('b', null, `Order #${o.id}`), badge(o.status)),
          h('p', { class: 'muted small clamp' }, o.items.map((i) => `${i.name} × ${i.qty}`).join(', ')),
          h('div', { class: 'row between' }, h('span', { class: 'muted small' }, fmtTime(o.created_at)), h('b', { class: 'num' }, rupee(o.total))))))
      : emptyState('No orders yet', 'Jab pehla order karoge, wo yaha dikhega.', h('a', { class: 'btn', href: '#/' }, 'Browse drinks')));
}
