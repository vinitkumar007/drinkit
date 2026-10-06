// One delivery job. "Packed" jobs need a pickup; "on the way" jobs need OTP + ID check at the door.
import { h, rupee } from '../shared/dom.js';
import { badge, safe, toast, confirmSheet, openSheet, closeSheet, field } from '../shared/ui.js';
import { api } from './state.js';

export function jobCard(job, reload) {
  const items = job.items.map((i) => `${i.name} × ${i.qty}`).join(', ');
  const collect = job.payment_method === 'cod' && job.payment_status !== 'paid';

  const head = h('div', { class: 'row between' },
    h('b', null, `Order #${job.id}`), badge(job.status));

  const info = [
    h('p', { class: 'small' }, items),
    h('p', null, job.address),
    h('div', { class: 'row wrap' },
      h('a', { class: 'btn ghost sm', href: 'tel:' + job.customer_phone }, `Call ${job.customer_name || 'customer'}`),
      h('a', { class: 'btn ghost sm', target: '_blank', rel: 'noopener', href: `https://www.google.com/maps/dir/?api=1&destination=${job.lat},${job.lng}` }, 'Open in Maps')),
    h('p', { class: collect ? 'collect' : 'muted small' }, collect ? `Collect ${rupee(job.total)} on delivery` : 'Already paid. Do not collect cash.'),
  ];

  if (job.status === 'packed') {
    const pickup = safe(async () => { await api.post(`/rider/orders/${job.id}/pickup`); toast('Picked up. Safe ride!'); reload(); });
    return h('article', { class: 'card job' }, head, ...info, h('button', { class: 'btn foil block', type: 'button', onclick: pickup }, 'I have picked up this order'));
  }

  // out_for_delivery: the two checks that make delivery legal
  const idBox = h('input', { type: 'checkbox', id: `id-${job.id}` });
  const otp = h('input', { type: 'text', inputMode: 'numeric', maxLength: 4, placeholder: '4 digit OTP', autocomplete: 'off', 'aria-label': 'Customer delivery OTP' });
  const deliverBtn = h('button', { class: 'btn foil block', type: 'submit' }, 'Complete delivery');

  const deliver = safe(async (e) => {
    e.preventDefault();
    deliverBtn.disabled = true;
    try {
      await api.post(`/rider/orders/${job.id}/deliver`, { otp: otp.value.trim(), id_checked: idBox.checked });
      toast('Delivered');
      reload();
    } finally { deliverBtn.disabled = false; }
  });

  const refuse = safe(async () => {
    const reason = h('select', null,
      h('option', null, 'No valid photo ID'),
      h('option', null, 'Customer looks underage'),
      h('option', null, 'Customer appears intoxicated'),
      h('option', null, 'Customer refused the order'),
      h('option', null, 'Nobody at the address'));
    await new Promise((resolve) => {
      const s = openSheet('Refuse this delivery?',
        h('p', { class: 'muted' }, 'Order cancel ho jayega aur stock store me wapas jayega.'),
        field('Reason', reason),
        h('div', { class: 'row', style: { marginTop: '16px', justifyContent: 'flex-end' } },
          h('button', { class: 'btn ghost', type: 'button', onclick: () => { s.close(); resolve(); } }, 'Go back'),
          h('button', { class: 'btn danger', type: 'button', onclick: safe(async () => {
            await api.post(`/rider/orders/${job.id}/refuse`, { reason: reason.value });
            closeSheet(); toast('Delivery refused. Return the order to the store.'); resolve(); reload();
          }) }, 'Refuse delivery')));
    });
  });

  return h('article', { class: 'card job' }, head, ...info,
    h('form', { class: 'stack-sm check-box', onsubmit: deliver },
      h('label', { class: 'check', for: `id-${job.id}` }, idBox,
        h('span', null, 'Maine customer ka original photo ID dekha. Umar theek hai aur customer hosh me hai.')),
      field('Delivery OTP (customer se lo)', otp),
      deliverBtn),
    h('button', { class: 'btn danger block', type: 'button', onclick: refuse }, 'Customer ne mana kiya / ID nahi'));
}
