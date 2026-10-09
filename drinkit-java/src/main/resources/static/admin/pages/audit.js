import { h, mount, fmtTime } from '../../shared/dom.js';
import { loading, errorState, emptyState } from '../../shared/ui.js';
import { api } from '../state.js';

function detail(meta) {
  if (!meta) return '';
  try { return Object.entries(JSON.parse(meta)).map(([k, v]) => `${k}: ${v}`).join(', '); } catch { return meta; }
}

export async function auditPage(root) {
  mount(root, loading());
  let log;
  try { log = await api.get('/admin/audit'); } catch (e) { return mount(root, errorState(e.message, () => auditPage(root))); }

  mount(root,
    h('h1', null, 'Audit log'),
    h('p', { class: 'muted small', style: { margin: '4px 0 14px' } }, 'Kaun sa admin ya rider kya badla. Excise inspection ya dispute me kaam aata hai. Latest 100 entries.'),
    log.length
      ? h('div', { class: 'card flush' }, h('div', { class: 'table-wrap' }, h('table', null,
        h('thead', null, h('tr', null, ['When', 'Who', 'Action', 'Item', 'Details'].map((t) => h('th', null, t)))),
        h('tbody', null, log.map((l) => h('tr', null,
          h('td', { class: 'muted small' }, fmtTime(l.created_at)), h('td', null, l.user_name || 'System'),
          h('td', null, h('b', null, l.action)), h('td', { class: 'muted' }, `${l.entity} ${l.entity_id ?? ''}`),
          h('td', { class: 'muted small' }, detail(l.meta))))))))
      : emptyState('Nothing logged yet'));
}
