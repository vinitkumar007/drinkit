// Single source of truth for the customer app: session, API client, location, cart.
import { createSession } from '../shared/session.js';
import { createApi } from '../shared/api.js';
import { RULES } from './config.js';

export const session = createSession('drinkit.customer');
export const api = createApi(session);

export const state = {
  user: null,
  loc: session.load('loc'),       // { label, lat, lng }
  svc: null,                      // result of /api/serviceability
  categories: [],
  products: [],                   // full catalog for the serving store
  cart: session.load('cart') || {}, // { [productId]: qty }
};

const subs = new Set();
export const subscribe = (fn) => { subs.add(fn); return () => subs.delete(fn); };
export const emit = () => subs.forEach((f) => f());

// ----- cart -----
export const cartCount = () => Object.values(state.cart).reduce((a, b) => a + b, 0);
export const productById = (id) => state.products.find((p) => p.id === Number(id));

export const cartLines = () => Object.entries(state.cart)
  .map(([id, qty]) => ({ product: productById(id), qty }))
  .filter((l) => l.product);

export const cartSubtotal = () => cartLines().reduce((s, l) => s + l.product.price * l.qty, 0);

export function deliveryFee(amountAfterDiscount) {
  return amountAfterDiscount >= RULES.freeDeliveryAbove ? 0 : RULES.deliveryFee;
}

/** Change quantity; returns an error message if the change is not allowed. */
export function changeQty(productId, delta) {
  const p = productById(productId);
  const next = (state.cart[productId] || 0) + delta;
  if (p && next > p.stock) return `Sirf ${p.stock} stock bacha hai`;
  if (delta > 0 && cartCount() >= RULES.maxItemsPerOrder) return `Ek order me max ${RULES.maxItemsPerOrder} items`;
  if (next <= 0) delete state.cart[productId]; else state.cart[productId] = next;
  persistCart();
  emit();
  return null;
}

export function clearCart() { state.cart = {}; persistCart(); emit(); }
const persistCart = () => session.save('cart', state.cart);

// ----- location / catalog -----
export function setLocation(loc) {
  state.loc = loc;
  session.save('loc', loc);
  clearCart();
}

export function forgetLocation() {
  state.loc = null; state.svc = null; state.products = [];
  session.save('loc', null);
  clearCart();
}

/** Looks up the serving store and loads its catalog. */
export async function refreshStore() {
  if (!state.loc) { state.svc = null; state.products = []; return; }
  state.svc = await api.get(`/serviceability?lat=${state.loc.lat}&lng=${state.loc.lng}`);
  if (!state.svc.serviceable) { state.products = []; return; }
  const [cats, products] = await Promise.all([
    state.categories.length ? state.categories : api.get('/categories'),
    api.get(`/products?store_id=${state.svc.store.id}`),
  ]);
  state.categories = cats;
  state.products = products;
  // Drop cart lines that no longer exist or exceed stock.
  for (const [id, qty] of Object.entries(state.cart)) {
    const p = productById(id);
    if (!p || p.stock < 1) delete state.cart[id]; else if (qty > p.stock) state.cart[id] = p.stock;
  }
  persistCart();
}

export async function loadUser() {
  if (!session.token) { state.user = null; return; }
  try { state.user = (await api.get('/me')).user; } catch { state.user = null; }
  session.user = state.user;
}
