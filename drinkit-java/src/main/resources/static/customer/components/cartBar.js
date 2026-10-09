import { h, mount, rupee } from '../../shared/dom.js';
import { cartCount, cartSubtotal } from '../state.js';

/** Floating summary bar. Pass null to hide it (every page except the shop). */
export function renderCartBar(onCheckout) {
  const root = document.getElementById('cart-root');
  const n = cartCount();
  if (!onCheckout || !n) return mount(root);
  mount(root, h('button', { class: 'cartbar', type: 'button', onclick: onCheckout },
    h('span', null, `${n} item${n > 1 ? 's' : ''}`),
    h('span', { class: 'num' }, `${rupee(cartSubtotal())}  ·  Checkout`)));
}
