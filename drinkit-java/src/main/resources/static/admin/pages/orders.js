import { h, mount, rupee, fmtTime } from '../../shared/dom.js';
import { badge, loading, errorState, emptyState, safe, toast, confirmSheet, STATUS_LABEL } from '../../shared/ui.js';
import { api } from '../state.js';

const NEXT = { placed: ['accepted', 'Accept'], accepted: ['packed', 'Mark packed'] };
let filter = '';

export function ordersPage(root) {
  let timer;
  let stopped = false;

  async function load() {
    let orders, riders;
    try {
      [orders, riders] = await Promise.all([
        api.get('/admin/orders' + (filter ? `?status=${filter}` : '')),
        api.get('/admin/riders'),
      ]);
    } catch (e) { if (!stopped) mount(root, errorState(e.message, load)); return; }
    if (stopped) return;
    draw(orders, riders);
    timer = setTimeout(load, 10000);
  }

  function draw(orders, riders) {
    const act = (id, status) => safe(async () => {
      if (status === 'cancelled' && !(await confirmSheet({ title: `Cancel order #${id}?`, message: 'Stock wapas store me chala jayega.', confirmLabel: 'Cancel order', danger: true }))) return;
      await api.patch(`/admin/orders/${id}/status`, { status });
      toast('Order updated');
      clearTimeout(timer); load();
    });
    const assign = (id) => safe(async (e) => {
      if (!e.target.value) return;
      await api.post(`/admin/orders/${id}/assign`, { rider_id: Number(e.target.value) });
      toast('Rider assigned');
      clearTimeout(timer); load();
    });

    const select = h('select', { 'aria-label': 'Filter by status', onchange: (e) => { filter = e.target.value; clearTimeout(timer); load(); } },
      h('option', { value: '' }, 'All statuses'),
      ...Object.entries(STATUS_LABEL).map(([k, v]) => h('option', { value: k, selected: filter === k }, v)));

    mount(root,
      h('div', { class: 'row between wrap' }, h('h1', null, 'Orders'), h('div', { style: { width: '200px' } }, select)),
      h('p', { class: 'muted small', style: { margin: '4px 0 14px' } }, 'Auto-refreshes every 10 seconds. Rider pickup aur delivery rider app se hoti hai.'),
      orders.length
        ? h('div', { class: 'stack' }, orders.map((o) => {
          const closed = ['delivered', 'cancelled'].includes(o.status);
          const storeRiders = riders.filter((r) => r.store_id === o.store_id);
          return h('article', { class: 'card order' },
            h('div', { class: 'row between wrap' },
              h('div', null, h('b', null, `#${o.id}`), h('span', { class: 'muted small' }, `  ${fmtTime(o.created_at)} · ${o.store_name}`)),
              badge(o.status)),
            h('p', { class: 'small' }, o.items.map((i) => `${i.name} × ${i.qty}`).join(', ')),
            h('div', { class: 'row between wrap small' },
              h('span', null, `${o.customer_name || 'Customer'} · ${o.customer_phone}`),
              h('b', { class: 'num' }, `${rupee(o.total)} ${o.payment_method.toUpperCase()}${o.payment_status === 'paid' ? ' (paid)' : ''}`)),
            h('p', { class: 'muted small' }, o.address),
            h('div', { class: 'row wrap', style: { marginTop: '4px' } },
              NEXT[o.status] && h('button', { class: 'btn sm', type: 'button', onclick: act(o.id, NEXT[o.status][0]) }, NEXT[o.status][1]),
              !closed && h('select', { class: 'rider-pick', 'aria-label': `Rider for order ${o.id}`, onchange: assign(o.id) },
                h('option', { value: '' }, o.rider_name ? `Rider: ${o.rider_name}` : 'Assign rider'),
                ...storeRiders.map((r) => h('option', { value: r.id }, `${r.name} (${r.active_jobs} active)`))),
              closed && o.rider_name && h('span', { class: 'muted small' }, `Rider: ${o.rider_name}`),
              !closed && h('button', { class: 'btn danger sm', type: 'button', onclick: act(o.id, 'cancelled') }, 'Cancel')));
        }))
        : emptyState('No orders here', filter ? 'Ye status filter hata ke dekho.' : 'Naya order aate hi yaha dikhega.'));
  }

  mount(root, loading());
  load();
  return () => { stopped = true; clearTimeout(timer); };
}
