// Tiny DOM helper. Text is always set with textContent / text nodes, so user data can never inject HTML.

/**
 * h('div', { class: 'card', onclick: fn, dataset: { id: 1 }, style: { color: 'red' } }, child, [children], 'text')
 * - props starting with "on" become event listeners
 * - boolean props toggle attributes (disabled, hidden, checked ...)
 * - falsy children (null/undefined/false) are skipped so you can write `cond && h(...)`
 */
export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function mount(root, ...nodes) {
  root.replaceChildren();
  append(root, nodes);
}

export const rupee = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

// SQLite stores UTC "YYYY-MM-DD HH:MM:SS"; show it in the viewer's local time.
export function fmtTime(s) {
  if (!s) return '';
  const d = new Date(String(s).replace(' ', 'T') + 'Z');
  if (isNaN(d)) return s;
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

export const sizeLabel = (ml) => (ml >= 1000 ? `${ml / 1000} L` : `${ml} ml`);

export function debounce(fn, ms = 250) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
