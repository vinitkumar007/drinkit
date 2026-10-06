// Central configuration. Everything tunable lives here (env vars override defaults).
const path = require('path');
const crypto = require('crypto');

const isProd = process.env.NODE_ENV === 'production';

if (isProd && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set when NODE_ENV=production');
}

module.exports = {
  isProd,
  port: Number(process.env.PORT) || 3000,
  dbFile: process.env.DB_FILE || path.join(__dirname, '..', 'data', 'drinkit.db'),
  publicDir: path.join(__dirname, '..', 'web'),
  jwtSecret: process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex'),
  jwtExpiry: '30d',

  otp: {
    ttlMs: 5 * 60 * 1000,
    maxAttempts: 5,
    exposeInResponse: !isProd, // never leak OTPs in production
  },
  rateLimit: {
    authWindowMs: 15 * 60 * 1000,
    authMax: Number(process.env.AUTH_RATE_MAX) || 30,
  },

  orders: {
    maxItemsPerOrder: 12,
    freeDeliveryAbove: 1000,
    deliveryFee: 30,
    deliveryOtpMaxAttempts: 5,
    cancellableStatuses: ['placed', 'accepted'],
    activeStatuses: ['placed', 'accepted', 'packed', 'out_for_delivery'],
  },

  // Tests/dev can disable store opening-hours checks.
  ignoreStoreHours: !!process.env.IGNORE_STORE_HOURS,
  timezone: 'Asia/Kolkata',
};
