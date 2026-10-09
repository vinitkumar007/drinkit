import { h, mount } from '../../shared/dom.js';
import { toast } from '../../shared/ui.js';
import { DEMO_LOCATIONS } from '../config.js';
import { setLocation } from '../state.js';

export function renderLocation(root, { unserviceable } = {}) {
  const choose = (loc) => { setLocation(loc); location.hash = '#/'; location.reload(); };

  const gps = () => {
    if (!navigator.geolocation) return toast('Is browser me location available nahi hai. Neeche se city chuno.', true);
    navigator.geolocation.getCurrentPosition(
      (p) => choose({ label: 'Current location', lat: p.coords.latitude, lng: p.coords.longitude }),
      () => toast('Location permission nahi mili. Neeche se city chuno.', true),
      { timeout: 10000 });
  };

  mount(root, h('section', { class: 'hero' },
    h('h1', null, unserviceable ? 'Abhi yaha delivery nahi hai' : 'Drinks, dispatched in minutes'),
    h('p', { class: 'muted lede' }, unserviceable
      ? unserviceable
      : 'Licensed stores se seedha aapke darwaze tak. Har order par age aur ID check hota hai.'),
    h('div', { class: 'row wrap', style: { marginTop: '22px' } },
      h('button', { class: 'btn foil', type: 'button', onclick: gps }, 'Use my current location')),
    h('h2', { class: 'section-title' }, 'Or pick a city'),
    h('div', { class: 'city-list' }, DEMO_LOCATIONS.map((l) =>
      h('button', { class: 'city', type: 'button', onclick: () => choose(l) }, l.label))),
    h('p', { class: 'legal' }, 'Alcohol ka sevan swasthya ke liye hanikarak hai. Sirf legal age ke logon ke liye. Sharab pikar gaadi na chalayein.')));
}
