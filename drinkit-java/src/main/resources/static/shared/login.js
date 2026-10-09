// Phone + OTP login sheet, shared by all three apps.
// Resolves with the logged-in user, or null if the person closes the sheet.
import { h } from './dom.js';
import { openSheet, closeSheet, safe, field, toast } from './ui.js';

// method: 'otp' (customers) or 'password' (admin / rider staff accounts, no SMS needed).
export function loginFlow({ api, session, title = 'Log in', intro = 'Apna mobile number daalo, hum OTP bhejenge.', allowedRoles, askName = false, method = 'otp' }) {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (v) => { if (!settled) { settled = true; resolve(v); } };

    const phoneStep = () => {
      const phone = h('input', { type: 'tel', inputMode: 'numeric', maxLength: 10, placeholder: '10 digit mobile number', autocomplete: 'tel-national', required: true });
      const form = h('form', { class: 'stack', onsubmit: safe(async (e) => {
        e.preventDefault();
        const num = phone.value.replace(/\D/g, '');
        const r = await api.post('/auth/request-otp', { phone: num });
        otpStep(num, r.dev_otp);
      }) },
        h('p', { class: 'muted' }, intro),
        field('Mobile number', phone),
        h('button', { class: 'btn block', type: 'submit' }, 'Send OTP'));
      const s = openSheet(title, form);
      s.sheet.querySelector('.x').addEventListener('click', () => settle(null));
    };

    const otpStep = (num, devOtp) => {
      const otp = h('input', { type: 'text', inputMode: 'numeric', maxLength: 6, placeholder: '6 digit OTP', autocomplete: 'one-time-code', required: true, value: devOtp || '' });
      const name = askName ? h('input', { type: 'text', maxLength: 60, placeholder: 'Pehli baar? Apna naam likho', autocomplete: 'name' }) : null;
      const form = h('form', { class: 'stack', onsubmit: safe(async (e) => {
        e.preventDefault();
        const r = await api.post('/auth/verify-otp', { phone: num, otp: otp.value.trim(), name: name ? name.value.trim() : undefined });
        if (allowedRoles && !allowedRoles.includes(r.user.role)) {
          throw new Error('Is number se is app me login allowed nahi hai.');
        }
        session.set(r.token, r.user);
        closeSheet();
        toast('Welcome' + (r.user.name ? ', ' + r.user.name : ''));
        settle(r.user);
      }) },
        h('p', { class: 'muted' }, `OTP bheja gaya: +91 ${num}`),
        devOtp && h('p', { class: 'small', style: { background: 'var(--warn-soft)', padding: '8px 10px', borderRadius: '8px' } }, `Dev mode: OTP ${devOtp} (SMS provider jodne par ye screen par nahi dikhega)`),
        field('OTP', otp),
        name && field('Naam', name),
        h('button', { class: 'btn block', type: 'submit' }, 'Verify and continue'),
        h('button', { class: 'btn ghost block', type: 'button', onclick: phoneStep }, 'Change number'));
      const s = openSheet('Enter OTP', form);
      s.sheet.querySelector('.x').addEventListener('click', () => settle(null));
    };

    const passwordStep = () => {
      const phone = h('input', { type: 'tel', inputMode: 'numeric', maxLength: 10, placeholder: '10 digit mobile number', autocomplete: 'username', required: true });
      const password = h('input', { type: 'password', placeholder: 'Password', autocomplete: 'current-password', required: true });
      const form = h('form', { class: 'stack', onsubmit: safe(async (e) => {
        e.preventDefault();
        const r = await api.post('/auth/staff-login', { phone: phone.value.replace(/\D/g, ''), password: password.value });
        if (allowedRoles && !allowedRoles.includes(r.user.role)) throw new Error('Is number se is app me login allowed nahi hai.');
        session.set(r.token, r.user);
        closeSheet();
        toast('Welcome' + (r.user.name ? ', ' + r.user.name : ''));
        settle(r.user);
      }) },
        h('p', { class: 'muted' }, intro),
        field('Mobile number', phone),
        field('Password', password),
        h('button', { class: 'btn block', type: 'submit' }, 'Log in'));
      const s = openSheet(title, form);
      s.sheet.querySelector('.x').addEventListener('click', () => settle(null));
    };

    (method === 'password' ? passwordStep : phoneStep)();
  });
}
