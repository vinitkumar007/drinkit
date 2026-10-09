// Customer app constants. The server is always the source of truth for prices and rules;
// these only drive the preview shown before an order is placed.
export const RULES = {
  maxItemsPerOrder: 12,
  freeDeliveryAbove: 1000,
  deliveryFee: 30,
};

// One-tap locations for demos and desktop testing (real phones use GPS).
export const DEMO_LOCATIONS = [
  { label: 'Connaught Place, Delhi', lat: 28.633, lng: 77.218 },
  { label: 'Saket, Delhi', lat: 28.5245, lng: 77.2066 },
  { label: 'Indiranagar, Bengaluru', lat: 12.979, lng: 77.641 },
  { label: 'Bandra, Mumbai', lat: 19.0596, lng: 72.8295 },
  { label: 'Park Street, Kolkata', lat: 22.5535, lng: 88.3523 },
  { label: 'Jaipur (no delivery yet)', lat: 26.9124, lng: 75.7873 },
];
