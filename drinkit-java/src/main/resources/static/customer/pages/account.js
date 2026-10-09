import { h, mount } from '../../shared/dom.js';
import { loading, safe, toast, field, confirmSheet, emptyState } from '../../shared/ui.js';
import { api, state, session } from '../state.js';

export async function renderAccount(root) {
  mount(root, loading());
  const addresses = await api.get('/addresses').catch(() => []);

  const name = h('input', { type: 'text', value: state.user.name || '', maxLength: 60, autocomplete: 'name' });
  const saveName = safe(async (e) => {
    e.preventDefault();
    const r = await api.patch('/me', { name: name.value.trim() });
    state.user = r.user;
    toast('Name saved');
  });

  const removeAddr = (a) => safe(async () => {
    if (!(await confirmSheet({ title: 'Remove address?', message: a.address, confirmLabel: 'Remove', danger: true }))) return;
    await api.del('/addresses/' + a.id);
    renderAccount(root);
  });

  const logout = () => { session.clear(); state.user = null; location.hash = '#/'; location.reload(); };

  mount(root,
    h('h1', null, 'Account'),
    h('div', { class: 'stack', style: { marginTop: '16px' } },
      h('form', { class: 'card stack', onsubmit: saveName },
        h('p', { class: 'muted small' }, `+91 ${state.user.phone}`),
        field('Name', name),
        h('button', { class: 'btn', type: 'submit' }, 'Save name')),
      h('div', { class: 'card' },
        h('h3', { style: { marginBottom: '8px' } }, 'Saved addresses'),
        addresses.length
          ? addresses.map((a) => h('div', { class: 'row between addr-row' },
            h('div', { class: 'grow' }, h('b', null, a.label), h('div', { class: 'muted small' }, a.address)),
            h('button', { class: 'btn ghost sm', type: 'button', onclick: removeAddr(a) }, 'Remove')))
          : emptyState('No saved addresses', 'Checkout me "Save this address" tick karo.')),
      h('div', { class: 'card' },
        h('p', { class: 'small' }, state.user.age_verified ? 'Age verified ✓' : 'Age not verified yet. You will be asked at checkout.')),
      h('button', { class: 'btn ghost block', type: 'button', onclick: logout }, 'Log out')));
}
