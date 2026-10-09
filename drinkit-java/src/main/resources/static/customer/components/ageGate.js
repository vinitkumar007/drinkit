import { h } from '../../shared/dom.js';
import { openSheet, closeSheet, safe, field, toast } from '../../shared/ui.js';
import { api, state } from '../state.js';

/** Opens the age check for the store's state. Resolves true once verified. */
export function ageGate() {
  return new Promise((resolve) => {
    const store = state.svc.store;
    const dob = h('input', { type: 'date', required: true, max: new Date().toISOString().slice(0, 10), autocomplete: 'bday' });
    const form = h('form', { class: 'stack', onsubmit: safe(async (e) => {
      e.preventDefault();
      await api.post('/auth/age', { dob: dob.value, state: store.state });
      state.user.age_verified = true;
      closeSheet();
      toast('Age verified');
      resolve(true);
    }) },
      h('p', null, `${store.state} me alcohol kharidne ki minimum umar ${store.min_age} saal hai.`),
      h('p', { class: 'muted small' }, 'Delivery par rider aapka original photo ID dekhega. ID nahi to order nahi milega.'),
      field('Date of birth', dob),
      h('button', { class: 'btn block', type: 'submit' }, 'Confirm my age'));
    const s = openSheet('Age check', form);
    s.sheet.querySelector('.x').addEventListener('click', () => resolve(false));
  });
}
