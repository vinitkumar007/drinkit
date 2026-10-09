import { h, mount } from '../../shared/dom.js';
import { loading, errorState, safe, toast, field } from '../../shared/ui.js';
import { api } from '../state.js';

const describe = (c) => (c.type === 'flat' ? `₹${c.value} off` : `${c.value}% off${c.max_discount ? ` (max ₹${c.max_discount})` : ''}`);

export async function couponsPage(root) {
  mount(root, loading());
  let coupons;
  try { coupons = await api.get('/admin/coupons'); } catch (e) { return mount(root, errorState(e.message, () => couponsPage(root))); }

  const f = {
    code: h('input', { type: 'text', required: true, minLength: 3, maxLength: 20, placeholder: 'e.g. DIWALI200', style: { textTransform: 'uppercase' } }),
    type: h('select', null, h('option', { value: 'flat' }, 'Flat amount (₹)'), h('option', { value: 'percent' }, 'Percent (%)')),
    value: h('input', { type: 'number', required: true, min: 1, step: 1 }),
    min: h('input', { type: 'number', min: 0, step: 1, placeholder: '0' }),
    max: h('input', { type: 'number', min: 1, step: 1, placeholder: 'optional' }),
    exp: h('input', { type: 'date' }),
  };
  const create = safe(async (e) => {
    e.preventDefault();
    await api.post('/admin/coupons', {
      code: f.code.value.trim(), type: f.type.value, value: Number(f.value.value),
      min_subtotal: f.min.value ? Number(f.min.value) : 0, max_discount: f.max.value ? Number(f.max.value) : undefined,
      expires_at: f.exp.value || undefined,
    });
    toast('Coupon created');
    couponsPage(root);
  });
  const toggle = (c) => safe(async () => { await api.patch('/admin/coupons/' + c.code, { active: !c.active }); couponsPage(root); });

  mount(root,
    h('h1', null, 'Coupons'),
    h('form', { class: 'card', style: { margin: '14px 0' }, onsubmit: create },
      h('h3', { style: { marginBottom: '10px' } }, 'New coupon'),
      h('div', { class: 'form-grid' },
        field('Code', f.code), field('Type', f.type), field('Value', f.value),
        field('Minimum order (₹)', f.min), field('Max discount (₹)', f.max, 'Percent coupons ke liye'), field('Expires on', f.exp)),
      h('button', { class: 'btn', type: 'submit', style: { marginTop: '12px' } }, 'Create coupon')),
    h('div', { class: 'card flush' }, h('div', { class: 'table-wrap' }, h('table', null,
      h('thead', null, h('tr', null, ['Code', 'Offer', 'Min order', 'Expires', 'Status', ''].map((t) => h('th', null, t)))),
      h('tbody', null, coupons.map((c) => h('tr', null,
        h('td', null, h('b', null, c.code)), h('td', null, describe(c)),
        h('td', { class: 'num' }, c.min_subtotal ? `₹${c.min_subtotal}` : 'None'),
        h('td', { class: 'muted' }, c.expires_at ? c.expires_at.slice(0, 10) : 'Never'),
        h('td', null, h('span', { class: 'badge ' + (c.active ? 'on' : 'off') }, c.active ? 'Active' : 'Off')),
        h('td', null, h('button', { class: 'btn ghost sm', type: 'button', onclick: toggle(c) }, c.active ? 'Turn off' : 'Turn on')))))))));
}
