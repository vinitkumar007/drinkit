import { h, mount, debounce } from '../../shared/dom.js';
import { emptyState } from '../../shared/ui.js';
import { state, subscribe, forgetLocation } from '../state.js';
import { productCard } from '../components/productCard.js';
import { renderCartBar } from '../components/cartBar.js';
import { startCheckout } from '../components/checkout.js';

let activeCat = 0;
let query = '';

export function renderShop(root) {
  const grid = h('div', { class: 'grid' });
  const chips = h('div', { class: 'chips', role: 'tablist', 'aria-label': 'Categories' });
  const search = h('input', {
    type: 'search', placeholder: 'Search whisky, beer, vodka, brand...', value: query, 'aria-label': 'Search products',
    oninput: debounce((e) => { query = e.target.value.trim().toLowerCase(); drawGrid(); }, 150),
  });

  function drawChips() {
    const mk = (id, text) => h('button', {
      class: 'chip' + (activeCat === id ? ' on' : ''), type: 'button', role: 'tab', 'aria-selected': String(activeCat === id),
      onclick: () => { activeCat = id; drawChips(); drawGrid(); },
    }, text);
    chips.replaceChildren(mk(0, 'All'), ...state.categories.map((c) => mk(c.id, `${c.emoji} ${c.name}`)));
  }

  function drawGrid() {
    const list = state.products.filter((p) =>
      (!activeCat || p.category_id === activeCat) &&
      (!query || p.name.toLowerCase().includes(query) || (p.brand || '').toLowerCase().includes(query)));
    grid.replaceChildren(...(list.length
      ? list.map((p) => productCard(p, redraw))
      : [emptyState('Nothing matches', 'Dusra naam ya category try karo.')]));
  }

  // Only the product controls and the cart bar change when the cart changes, so redraw just those.
  function redraw() { drawGrid(); renderCartBar(startCheckout); }

  mount(root,
    h('div', { class: 'where' },
      h('div', null, h('b', null, state.loc.label || 'Your location'), h('div', { class: 'muted small' }, `Served by ${state.svc.store.name}`)),
      h('button', { class: 'btn ghost sm', type: 'button', onclick: () => { forgetLocation(); location.reload(); } }, 'Change')),
    h('div', { class: 'toolbar' }, search, chips),
    grid,
    h('p', { class: 'legal' }, 'Alcohol ka sevan swasthya ke liye hanikarak hai. Sirf legal age ke logon ke liye.'));

  drawChips();
  drawGrid();
  renderCartBar(startCheckout);
  const unsub = subscribe(() => renderCartBar(startCheckout));
  return () => unsub();
}
