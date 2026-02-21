// middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');
const logger = require('../config/logger');

// ─────────────────────────────────────────────────────────────────────────────
// SHARED: Log when a client gets rate limited
// ─────────────────────────────────────────────────────────────────────────────
const onLimitReached = (req, res, options) => {
  logger.warn('rateLimiter: limit reached', {
    ip:       req.ip,
    path:     req.originalUrl,
    method:   req.method,
    limit:    options.max,
    windowMs: options.windowMs,
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// SHARED: Standard rate limit response shape
// ─────────────────────────────────────────────────────────────────────────────
const handler = (req, res, next, options) => {
  onLimitReached(req, res, options);
  res.status(429).json({
    success: false,
    message: 'Too many requests. Please try again later.',
    retryAfter: Math.ceil(options.windowMs / 1000 / 60), // in minutes
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// TIER 1 — General public API
// Applied broadly to all /api routes as a baseline DDoS guard.
// 100 requests per minute per IP is generous for normal use.
// ─────────────────────────────────────────────────────────────────────────────
const generalLimiter = rateLimit({
  windowMs:         60 * 1000,   // 1 minute
  max:              100,
  standardHeaders:  true,        // return RateLimit-* headers (RFC 6585)
  legacyHeaders:    false,
  handler,
  skip: (req) => req.method === 'OPTIONS', // never block CORS preflight
});

// ─────────────────────────────────────────────────────────────────────────────
// TIER 2 — Auth endpoints (login, register)
// Tight window to slow brute-force password attacks.
// 10 attempts per 15 minutes per IP.
// ─────────────────────────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs:         15 * 60 * 1000, // 15 minutes
  max:              10,
  standardHeaders:  true,
  legacyHeaders:    false,
  handler,
  skip: (req) => req.method === 'OPTIONS',
});

// ─────────────────────────────────────────────────────────────────────────────
// TIER 3 — OTP endpoints (send, resend, verify)
// Most sensitive — OTP abuse is expensive (Twilio costs) and a security risk.
// 5 attempts per 10 minutes per IP.
// ─────────────────────────────────────────────────────────────────────────────
const otpLimiter = rateLimit({
  windowMs:         10 * 60 * 1000, // 10 minutes
  max:              5,
  standardHeaders:  true,
  legacyHeaders:    false,
  handler,
  skip: (req) => req.method === 'OPTIONS',
});

// ─────────────────────────────────────────────────────────────────────────────
// TIER 4 — File upload / S3 presigned URL endpoints
// Large payloads + S3 costs — throttle hard.
// 20 requests per minute per IP.
// ─────────────────────────────────────────────────────────────────────────────
const uploadLimiter = rateLimit({
  windowMs:         60 * 1000,   // 1 minute
  max:              20,
  standardHeaders:  true,
  legacyHeaders:    false,
  handler,
  skip: (req) => req.method === 'OPTIONS',
});

// ─────────────────────────────────────────────────────────────────────────────
// TIER 5 — Public search / catalog endpoints
// Higher limit since these are read-heavy and used by mobile apps.
// 200 requests per minute per IP.
// ─────────────────────────────────────────────────────────────────────────────
const searchLimiter = rateLimit({
  windowMs:         60 * 1000,   // 1 minute
  max:              200,
  standardHeaders:  true,
  legacyHeaders:    false,
  handler,
  skip: (req) => req.method === 'OPTIONS',
});

// ─────────────────────────────────────────────────────────────────────────────
// TIER 6 — Stripe webhook
// Must NOT be rate limited — Stripe retries are legitimate and time-sensitive.
// Exported as a passthrough so routes stay consistent without special-casing.
// ─────────────────────────────────────────────────────────────────────────────
const webhookLimiter = rateLimit({
  windowMs:         60 * 1000,
  max:              500,         // effectively unlimited for normal webhook volume
  standardHeaders:  false,
  legacyHeaders:    false,
  skip: () => true,              // always skip — safety net in case this is removed
});

module.exports = {
  generalLimiter,
  authLimiter,
  otpLimiter,
  uploadLimiter,
  searchLimiter,
  webhookLimiter,
};