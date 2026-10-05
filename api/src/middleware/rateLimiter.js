/**
 * Rate limiting for sensitive endpoints.
 *
 * Each limiter targets a different abuse case:
 *  - loginLimiter     brute-force / credential stuffing. Only FAILED logins
 *                     (401) count, so a legitimate user who logs in
 *                     successfully is never locked out by their own use.
 *  - registerLimiter  mass fake-account creation from one IP (only accounts
 *                     actually created count towards the limit).
 *  - bookingLimiter   booking spam. Keyed per authenticated USER rather than
 *                     per IP, so one abusive account can't hide behind
 *                     changing IPs, and users sharing an IP (e.g. a campus
 *                     network) don't throttle each other.
 *  - apiLimiter       a generous global ceiling against scraping/flooding.
 *
 * Limits are read from env.js so they can be tuned per environment. When a
 * limit is hit the client receives a 429 with a clear message and a
 * `retryAfterSeconds` value, and the event is logged for monitoring.
 */
const rateLimit = require('express-rate-limit'); // Third-party middleware that tracks and caps requests per client.
const { rateLimits } = require('../config/env');
const logger = require('../utils/logger');

/**
 * Builds a limiter with the shared response shape. Exported so tests can
 * create limiters with tiny limits without touching the app's real ones.
 */
function createLimiter({ name, max, windowMs = rateLimits.windowMs, message, ...options }) {
  return rateLimit({
    windowMs, // The rolling time window each client is measured over.
    limit: max, // Requests allowed per client per window.
    standardHeaders: 'draft-7', // Send a combined `RateLimit` header plus `RateLimit-Policy`, so clients can see their budget.
    legacyHeaders: false, // Don't also send the older, non-standard `X-RateLimit-*` headers (avoids duplication).
    handler: (req, res, next, opts) => {
      const retryAfterSeconds = Math.ceil(opts.windowMs / 1000);
      logger.security('RATE_LIMIT_EXCEEDED', {
        limiter: name,
        ip: req.ip,
        userId: req.user && req.user.id,
        path: req.originalUrl,
      });
      res.set('Retry-After', String(retryAfterSeconds));
      res.status(429).json({
        success: false, // Keep the same response shape as every other error in this API.
        message,
        retryAfterSeconds,
      });
    },
    ...options,
  });
}

const loginLimiter = createLimiter({
  name: 'login',
  max: rateLimits.loginMax,
  message: 'Too many failed login attempts. Please wait 15 minutes before trying again.',
  requestWasSuccessful: (req, res) => res.statusCode !== 401, // Only wrong-credential responses use up the budget...
  skipSuccessfulRequests: true, // ...and everything else is refunded.
});

const registerLimiter = createLimiter({
  name: 'register',
  max: rateLimits.registerMax,
  message: 'Too many accounts created from this device. Please try again later.',
  skipFailedRequests: true, // Only accounts actually created count - rejected sign-ups don't create fake accounts.
});

const bookingLimiter = createLimiter({
  name: 'booking',
  max: rateLimits.bookingMax,
  message: 'You are making bookings too quickly. Please wait a few minutes and try again.',
  keyGenerator: (req) => `user:${req.user.id}`, // Runs after `protect`, so req.user is always set.
});

const apiLimiter = createLimiter({
  name: 'api',
  max: rateLimits.apiMax,
  message: 'Too many requests. Please slow down and try again shortly.',
});

module.exports = { createLimiter, loginLimiter, registerLimiter, bookingLimiter, apiLimiter };
