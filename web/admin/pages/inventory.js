import { h, mount } from '../../shared/dom.js';
import { loading, errorState, safe, toast } from '../../shared/ui.js';
import { api } from '../state.js';

let storeId = null;
let text = '';

export async function inventoryPage(root) {
  mount(root, loading());
  let stores;
  try { stores = await api.get('/admin/stores'); } catch (e) { return mount(root, errorState(e.message, () => inventoryPage(root))); }
  if (!storeId) storeId = stores[0].id;

  let rows;
  try { rows = await api.get('/admin/inventory?store_id=' + storeId); } catch (e) { return mount(root, errorState(e.message, () => inventoryPage(root))); }

  const body = h('tbody');
  const draw = () => body.replaceChildren(...rows
    .filter((r) => !text || `${r.name} ${r.brand || ''} ${r.category}`.toLowerCase().includes(text))
    .map((r) => {
      const input = h('input', { type: 'number', min: 0, max: 100000, step: 1, value: String(r.stock), 'aria-label': `Stock for ${r.name}`, class: 'stock-in' });
      const save = safe(async () => {
        const n = Number(input.value);
        if (!Number.isInteger(n) || n < 0) { input.value = r.stock; throw new Error('Stock 0 ya usse zyada poora number hona chahiye'); }
        if (n === r.stock) return;
        await api.patch('/admin/inventory', { store_id: storeId, product_id: r.product_id, stock: n });
        r.stock = n;
        toast(`${r.name}: stock ${n}`);
        input.classList.toggle('low', n <= 5);
      });
      input.classList.toggle('low', r.stock <= 5);
      input.addEventListener('change', save);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
      return h('tr', { class: r.active ? '' : 'inactive' },
        h('td', null, h('b', null, r.name), !r.active && h('span', { class: 'badge off', style: { marginLeft: '8px' } }, 'Hidden')),
        h('td', { class: 'muted' }, r.category), h('td', { class: 'num' }, `₹${r.price}`), h('td', null, input));
    }));

  mount(root,
    h('h1', null, 'Inventory'),
    h('div', { class: 'row wrap', style: { margin: '14px 0' } },
      h('select', { 'aria-label': 'Store', style: { maxWidth: '280px' }, onchange: (e) => { storeId = Number(e.target.value); inventoryPage(root); } },
        ...stores.map((s) => h('option', { value: s.id, selected: s.id === storeId }, s.name))),
      h('input', { type: 'search', placeholder: 'Filter products', value: text, style: { maxWidth: '240px' }, 'aria-label': 'Filter products',
        oninput: (e) => { text = e.target.value.trim().toLowerCase(); draw(); } })),
    h('div', { class: 'card flush' }, h('div', { class: 'table-wrap' }, h('table', null,
      h('thead', null, h('tr', null, ['Product', 'Category', 'Price', 'Stock'].map((t) => h('th', null, t)))), body))),
    h('p', { class: 'hint' }, 'Number badalte hi save ho jata hai. 5 ya usse kam stock red dikhta hai.'));
  draw();
}
