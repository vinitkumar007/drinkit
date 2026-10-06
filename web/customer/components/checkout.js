import { h, rupee } from '../../shared/dom.js';
import { openSheet, closeSheet, safe, field, toast } from '../../shared/ui.js';
import { api, state, cartLines, cartSubtotal, deliveryFee, clearCart } from '../state.js';
import { login } from './header.js';
import { ageGate } from './ageGate.js';

/** Full checkout flow: login -> age check -> address, coupon, payment -> place order. */
export async function startCheckout() {
  if (!state.user) {
    const user = await login();
    if (!user) return;
  }
  if (!state.user.age_verified && !(await ageGate())) return;
  openCheckoutSheet();
}

async function openCheckoutSheet() {
  const saved = await api.get('/addresses').catch(() => []);
  let coupon = null; // { code, discount }

  const addressText = h('textarea', { placeholder: 'Flat, building, street, landmark', maxLength: 300 });
  const saveIt = h('input', { type: 'checkbox' });
  const label = h('input', { type: 'text', value: 'Home', maxLength: 30 });
  const newBox = h('div', { class: 'stack-sm' },
    field('Delivery address', addressText, `Location: ${state.loc.label || 'current location'}`),
    h('div', { class: 'row wrap' },
      h('label', { class: 'check' }, saveIt, h('span', null, 'Save this address')),
      h('div', { class: 'grow' }, label)));

  const choices = [];
  const radios = saved.map((a, i) => {
    const r = h('input', { type: 'radio', name: 'addr', value: String(a.id), checked: i === 0, onchange: syncAddress });
    choices.push(r);
    return h('label', { class: 'check addr-choice' }, r, h('span', null, h('b', null, a.label), h('br'), h('span', { class: 'muted small' }, a.address)));
  });
  const newRadio = h('input', { type: 'radio', name: 'addr', value: 'new', checked: saved.length === 0, onchange: syncAddress });
  function syncAddress() { newBox.hidden = !newRadio.checked; }

  const couponInput = h('input', { type: 'text', placeholder: 'Coupon code', maxLength: 20, autocapitalize: 'characters' });
  const couponMsg = h('p', { class: 'hint' });
  const payment = h('select', null,
    h('option', { value: 'cod' }, 'Pay on delivery (cash / UPI)'),
    h('option', { value: 'upi' }, 'UPI (demo)'),
    h('option', { value: 'card' }, 'Card (demo)'));

  const summary = h('div');
  const placeBtn = h('button', { class: 'btn foil block', type: 'submit' }, 'Place order');

  function renderSummary() {
    const sub = cartSubtotal();
    const discount = coupon ? coupon.discount : 0;
    const fee = deliveryFee(sub - discount);
    const total = sub - discount + fee;
    summary.replaceChildren(
      ...cartLines().map((l) => h('div', { class: 'line' }, h('span', null, `${l.product.name} × ${l.qty}`), h('span', { class: 'num' }, rupee(l.product.price * l.qty)))),
      h('div', { class: 'line muted' }, h('span', null, 'Delivery'), h('span', null, fee ? rupee(fee) : 'Free')),
      coupon && h('div', { class: 'line', style: { color: 'var(--ok)' } }, h('span', null, `Coupon ${coupon.code}`), h('span', { class: 'num' }, '− ' + rupee(discount))),
      h('div', { class: 'line total' }, h('span', null, 'Total'), h('span', { class: 'num' }, rupee(total))));
    placeBtn.textContent = `Place order · ${rupee(total)}`;
  }

  const applyCoupon = safe(async () => {
    if (!couponInput.value.trim()) return;
    try {
      coupon = await api.post('/coupons/validate', { code: couponInput.value.trim(), subtotal: cartSubtotal() });
      couponMsg.textContent = `Applied: ${coupon.code}`;
    } catch (e) { coupon = null; couponMsg.textContent = e.message; }
    renderSummary();
  });

  const form = h('form', { class: 'stack', onsubmit: safe(async (e) => {
    e.preventDefault();
    placeBtn.disabled = true;
    try {
      const body = {
        items: Object.entries(state.cart).map(([product_id, qty]) => ({ product_id: Number(product_id), qty })),
        payment_method: payment.value,
        coupon_code: coupon ? coupon.code : undefined,
      };
      const chosen = choices.find((r) => r.checked);
      if (chosen && !newRadio.checked) {
        body.address_id = Number(chosen.value);
      } else {
        body.address = addressText.value.trim();
        body.lat = state.loc.lat;
        body.lng = state.loc.lng;
        if (saveIt.checked && body.address.length >= 8) {
          await api.post('/addresses', { label: label.value.trim() || 'Home', address: body.address, lat: body.lat, lng: body.lng });
        }
      }
      const order = await api.post('/orders', body);
      clearCart();
      closeSheet();
      toast('Order placed');
      location.hash = '#/order/' + order.id;
    } finally { placeBtn.disabled = false; }
  }) },
    h('div', { class: 'stack-sm' }, ...radios,
      h('label', { class: 'check addr-choice' }, newRadio, h('span', null, saved.length ? 'Use a new address' : 'Delivery address')),
      newBox),
    h('div', { class: 'row' }, h('div', { class: 'grow' }, couponInput),
      h('button', { class: 'btn ghost', type: 'button', onclick: applyCoupon }, 'Apply')),
    couponMsg,
    field('Payment', payment),
    h('hr', { class: 'divider' }),
    summary,
    h('p', { class: 'muted small' }, 'Delivery par aapko 4 digit OTP milega. Rider OTP aur original photo ID dono check karega.'),
    placeBtn);

  syncAddress();
  renderSummary();
  openSheet('Checkout', form);
}
