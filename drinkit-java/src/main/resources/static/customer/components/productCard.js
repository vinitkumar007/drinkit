import { h, rupee, sizeLabel } from '../../shared/dom.js';
import { toast } from '../../shared/ui.js';
import { state, changeQty } from '../state.js';

const TINT = { 1: 'amber', 2: 'gold', 3: 'frost', 4: 'rum', 5: 'wine', 6: 'juniper', 7: 'mix' };

export function productCard(p, onChange) {
  const qty = state.cart[p.id] || 0;
  const bump = (d) => () => {
    const err = changeQty(p.id, d);
    if (err) toast(err, true); else onChange();
  };

  const control = p.stock < 1
    ? h('span', { class: 'muted small' }, 'Out of stock')
    : qty
      ? h('div', { class: 'stepper' },
        h('button', { type: 'button', 'aria-label': `Remove one ${p.name}`, onclick: bump(-1) }, '−'),
        h('span', { class: 'num', 'aria-live': 'polite' }, String(qty)),
        h('button', { type: 'button', 'aria-label': `Add one ${p.name}`, onclick: bump(1) }, '+'))
      : h('button', { class: 'btn ghost sm add', type: 'button', onclick: bump(1), 'aria-label': `Add ${p.name}` }, 'Add');

  const meta = [p.brand, sizeLabel(p.size_ml), p.abv ? `${p.abv}% alc.` : null].filter(Boolean).join(', ');

  return h('article', { class: 'prod', dataset: { id: p.id } },
    h('div', { class: 'swatch ' + (TINT[p.category_id] || 'mix'), 'aria-hidden': 'true' }, p.category.slice(0, 1)),
    h('div', { class: 'prod-body' },
      h('h3', null, p.name),
      h('p', { class: 'muted small' }, meta),
      p.stock > 0 && p.stock <= 5 && h('p', { class: 'low small' }, `Only ${p.stock} left`)),
    h('div', { class: 'prod-foot' }, h('span', { class: 'price num' }, rupee(p.price)), control));
}
