// Shared UI pieces: toast, modal sheet, confirm, badges, loading + empty states.
import { h, $ } from './dom.js';

export const STATUS_LABEL = {
  placed: 'Placed', accepted: 'Accepted', packed: 'Packed',
  out_for_delivery: 'On the way', delivered: 'Delivered', cancelled: 'Cancelled',
};
export const STATUS_FLOW = ['placed', 'accepted', 'packed', 'out_for_delivery', 'delivered'];

export const badge = (status, label) => h('span', { class: 'badge ' + status }, label || STATUS_LABEL[status] || status);

// ----- toast -----
export function toast(message, isError = false) {
  let box = $('.toasts');
  if (!box) { box = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' }); document.body.append(box); }
  const t = h('div', { class: 'toast' + (isError ? ' err' : '') }, message);
  box.append(t);
  setTimeout(() => t.remove(), isError ? 4500 : 2800);
}

// Wrap an async click/submit handler so API errors show as a toast instead of an unhandled rejection.
export const safe = (fn) => async (...args) => {
  try { return await fn(...args); } catch (e) { toast(e.message || 'Kuch galat ho gaya', true); }
};

// ----- modal sheet -----
let closeCurrent = null;

export function openSheet(title, ...content) {
  closeSheet();
  const prevFocus = document.activeElement;
  const close = () => {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
    closeCurrent = null;
    if (prevFocus && prevFocus.focus) prevFocus.focus();
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div', { class: 'sheet-head' }, h('h2', null, title), h('button', { class: 'x', type: 'button', 'aria-label': 'Close', onclick: close }, '×')),
    ...content);
  const overlay = h('div', { class: 'overlay', onmousedown: (e) => { if (e.target === overlay) close(); } }, sheet);
  document.body.append(overlay);
  document.addEventListener('keydown', onKey);
  closeCurrent = close;
  const first = sheet.querySelector('input, select, textarea, button.btn');
  if (first) first.focus();
  return { close, sheet };
}

export function closeSheet() { if (closeCurrent) closeCurrent(); }

export function confirmSheet({ title, message, confirmLabel = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    const { close } = openSheet(title,
      h('p', { class: 'muted' }, message),
      h('div', { class: 'row', style: { marginTop: '18px', justifyContent: 'flex-end' } },
        h('button', { class: 'btn ghost', type: 'button', onclick: () => { close(); finish(false); } }, 'Go back'),
        h('button', { class: 'btn' + (danger ? ' danger' : ''), type: 'button', onclick: () => { close(); finish(true); } }, confirmLabel)));
  });
}

// ----- states -----
export const loading = () => h('div', { class: 'spinner', role: 'status', 'aria-label': 'Loading' });

export const emptyState = (title, text, action) =>
  h('div', { class: 'empty' }, h('h3', null, title), text && h('p', null, text), action && h('div', { style: { marginTop: '14px' } }, action));

export const errorState = (message, retry) =>
  emptyState('Could not load this', message, retry && h('button', { class: 'btn ghost', type: 'button', onclick: retry }, 'Try again'));

export function field(label, input, hint) {
  return h('label', { class: 'field' }, h('span', null, label), input, hint && h('div', { class: 'hint' }, hint));
}
