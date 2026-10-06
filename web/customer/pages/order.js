import { h, mount, rupee, fmtTime } from '../../shared/dom.js';
import { badge, loading, errorState, confirmSheet, safe, toast, STATUS_FLOW, STATUS_LABEL } from '../../shared/ui.js';
import { api } from '../state.js';

const ACTIVE = ['placed', 'accepted', 'packed', 'out_for_delivery'];

/** Live order page. Polls every 5s while the order is active. Returns a cleanup function. */
export function renderOrder(root, id) {
  let timer = null;
  let stopped = false;

  async function load(first) {
    let o;
    try { o = await api.get('/orders/' + id); } catch (e) {
      if (first) mount(root, errorState(e.message, () => load(true)));
      return;
    }
    if (stopped) return;
    draw(o);
    clearTimeout(timer);
    if (ACTIVE.includes(o.status)) timer = setTimeout(() => load(false), 5000);
  }

  function draw(o) {
    const reached = STATUS_FLOW.indexOf(o.status);
    const cancellable = ['placed', 'accepted'].includes(o.status);

    const cancel = safe(async () => {
      if (!(await confirmSheet({ title: 'Cancel this order?', message: 'Stock wapas store me chala jayega.', confirmLabel: 'Cancel order', danger: true }))) return;
      await api.post(`/orders/${o.id}/cancel`);
      toast('Order cancelled');
      load(false);
    });

    mount(root,
      h('a', { class: 'back', href: '#/orders' }, '‹ All orders'),
      h('div', { class: 'row between', style: { margin: '10px 0 16px' } }, h('h1', null, `Order #${o.id}`), badge(o.status)),
      h('div', { class: 'stack' },

        o.status === 'cancelled'
          ? h('div', { class: 'card' }, h('b', null, 'This order was cancelled.'), h('p', { class: 'muted small' }, 'Payment aur stock automatically wapas ho jata hai.'))
          : h('div', { class: 'card' },
            h('ol', { class: 'steps', 'aria-label': 'Order progress' }, STATUS_FLOW.map((s, i) =>
              h('li', { class: i < reached ? 'done' : i === reached ? 'now' : '', 'aria-current': i === reached ? 'step' : null }, STATUS_LABEL[s]))),
            o.status !== 'delivered' && h('p', { class: 'muted small center' },
              `Expected in about ${o.eta_minutes} min from ${o.store_name}` + (o.rider_name ? ` · Rider ${o.rider_name}` : ''))),

        ACTIVE.includes(o.status) && o.delivery_otp && h('div', { class: 'card' },
          h('p', { class: 'center small muted' }, 'Share this OTP with the rider, along with your photo ID'),
          h('div', { class: 'otp-code', 'aria-label': 'Delivery OTP' }, o.delivery_otp)),

        h('div', { class: 'card' },
          ...o.items.map((i) => h('div', { class: 'line' }, h('span', null, `${i.name} × ${i.qty}`), h('span', { class: 'num' }, rupee(i.price * i.qty)))),
          h('div', { class: 'line muted' }, h('span', null, 'Delivery'), h('span', null, o.delivery_fee ? rupee(o.delivery_fee) : 'Free')),
          o.discount > 0 && h('div', { class: 'line', style: { color: 'var(--ok)' } }, h('span', null, `Coupon ${o.coupon_code}`), h('span', { class: 'num' }, '− ' + rupee(o.discount))),
          h('div', { class: 'line total' }, h('span', null, `Total (${o.payment_method.toUpperCase()}, ${o.payment_status})`), h('span', { class: 'num' }, rupee(o.total))),
          h('hr', { class: 'divider' }),
          h('p', { class: 'small' }, o.address)),

        h('div', { class: 'card' },
          h('h3', { style: { marginBottom: '10px' } }, 'Timeline'),
          h('ul', { class: 'timeline' }, [...o.events].reverse().map((e) =>
            h('li', null, h('b', null, STATUS_LABEL[e.status] || e.status), h('span', { class: 'muted small' }, ` ${fmtTime(e.created_at)}`), e.note && h('div', { class: 'muted small' }, e.note))))),

        cancellable && h('button', { class: 'btn danger block', type: 'button', onclick: cancel }, 'Cancel order')));
  }

  mount(root, loading());
  load(true);
  return () => { stopped = true; clearTimeout(timer); };
}
