import { h, mount, rupee, sizeLabel } from '../../shared/dom.js';
import { loading, errorState, safe, toast, field } from '../../shared/ui.js';
import { api } from '../state.js';

export async function productsPage(root) {
  mount(root, loading());
  let products, categories;
  try { [products, categories] = await Promise.all([api.get('/admin/products'), api.get('/categories')]); }
  catch (e) { return mount(root, errorState(e.message, () => productsPage(root))); }

  const f = {
    category: h('select', null, ...categories.map((c) => h('option', { value: c.id }, `${c.emoji} ${c.name}`))),
    name: h('input', { type: 'text', required: true, maxLength: 100 }),
    brand: h('input', { type: 'text', maxLength: 60 }),
    size: h('input', { type: 'number', required: true, min: 1, step: 1, placeholder: 'ml' }),
    abv: h('input', { type: 'number', min: 0, max: 100, step: 0.1, placeholder: 'optional' }),
    price: h('input', { type: 'number', required: true, min: 1, step: 1, placeholder: '₹' }),
  };
  const add = safe(async (e) => {
    e.preventDefault();
    await api.post('/admin/products', {
      category_id: Number(f.category.value), name: f.name.value.trim(), brand: f.brand.value.trim() || undefined,
      size_ml: Number(f.size.value), abv: f.abv.value === '' ? undefined : Number(f.abv.value), price: Number(f.price.value),
    });
    toast('Product added. Ab Inventory me stock set karo.');
    productsPage(root);
  });

  const rows = products.map((p) => {
    const price = h('input', { type: 'number', min: 1, step: 1, value: String(p.price), class: 'stock-in', 'aria-label': `Price of ${p.name}` });
    price.addEventListener('change', safe(async () => {
      const n = Number(price.value);
      if (!Number.isInteger(n) || n < 1) { price.value = p.price; throw new Error('Price 1 ya usse zyada poora number ho'); }
      await api.patch('/admin/products/' + p.id, { price: n });
      p.price = n;
      toast(`${p.name}: ${rupee(n)}`);
    }));
    const toggle = safe(async () => {
      await api.patch('/admin/products/' + p.id, { active: !p.active });
      toast(p.active ? 'Product hidden from shop' : 'Product visible again');
      productsPage(root);
    });
    return h('tr', { class: p.active ? '' : 'inactive' },
      h('td', null, h('b', null, p.name), h('div', { class: 'muted small' }, [p.brand, sizeLabel(p.size_ml), p.abv ? p.abv + '%' : null].filter(Boolean).join(', '))),
      h('td', { class: 'muted' }, p.category), h('td', null, price),
      h('td', null, h('button', { class: 'btn ghost sm', type: 'button', onclick: toggle }, p.active ? 'Hide' : 'Show')));
  });

  mount(root,
    h('h1', null, 'Products'),
    h('form', { class: 'card', style: { margin: '14px 0' }, onsubmit: add },
      h('h3', { style: { marginBottom: '10px' } }, 'Add a product'),
      h('div', { class: 'form-grid' },
        field('Category', f.category), field('Name', f.name), field('Brand', f.brand),
        field('Size (ml)', f.size), field('Alcohol %', f.abv), field('Price (₹)', f.price)),
      h('button', { class: 'btn', type: 'submit', style: { marginTop: '12px' } }, 'Add product')),
    h('div', { class: 'card flush' }, h('div', { class: 'table-wrap' }, h('table', null,
      h('thead', null, h('tr', null, ['Product', 'Category', 'Price (₹)', ''].map((t) => h('th', null, t)))), h('tbody', null, rows)))));
}
