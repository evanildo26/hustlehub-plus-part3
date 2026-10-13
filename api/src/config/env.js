/**
 * Centralised environment configuration.
 *
 * Reading process.env directly all over the codebase makes it easy to
 * misspell a variable name and get `undefined` at runtime with no warning.
 * Instead we read everything once here, apply sane defaults where it is
 * safe to do so, and fail fast (loudly, at startup) when something the
 * application cannot safely run without is missing - e.g. the JWT secret.
 */
const path = require('path'); // Built-in module for building OS-independent file paths.
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true }); // Loads variables from api/.env into process.env.

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim() === '') {
  // Fail fast and clearly - a missing secret must never silently fall back
  // to an insecure default in a security-focused application.
  console.error('Missing required environment variable JWT_SECRET. Copy .env.example to .env and set it before starting the server.');
  process.exit(1); // Stop the process immediately rather than run with an undefined/insecure JWT secret.
}

if (process.env.JWT_SECRET.length < 32) {
  // A short secret can be brute-forced offline from any captured token, letting an attacker forge JWTs.
  console.error('JWT_SECRET must be at least 32 characters long. Generate one as described in .env.example.');
  process.exit(1);
}

/** Parses a positive integer env value, falling back to a default when unset/invalid. */
function positiveInt(raw, fallback) {
  const value = parseInt(raw, 10); // NaN if unset or not a number.
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

const nodeEnv = process.env.NODE_ENV || 'development'; // Which environment we're running in; defaults to 'development' if unset.

module.exports = {
  nodeEnv,
  port: positiveInt(process.env.PORT, 5000), // Convert the PORT string to a number; fall back to 5000 if missing/invalid.
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hustlehub', // MongoDB connection string (local dev default).
  jwtSecret: process.env.JWT_SECRET, // The secret key used to sign and verify JWTs - required, so no fallback here.
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h', // How long an issued token stays valid; defaults to 1 hour.
  jwtIssuer: 'hustlehub-api', // `iss` claim - identifies this API as the token issuer.
  jwtAudience: 'hustlehub-client', // `aud` claim - identifies who the token is intended for.
  corsOrigins: (process.env.CORS_ORIGIN || 'https://localhost:5173') // Comma-separated list of allowed frontend origins.
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  // Number of reverse proxies in front of the API (1 behind the Docker nginx
  // container). 0 = trust none: X-Forwarded-For is ignored, so a client
  // can't fake its IP to dodge per-IP rate limits when the API is exposed directly.
  trustProxy: Number.isInteger(parseInt(process.env.TRUST_PROXY, 10)) ? parseInt(process.env.TRUST_PROXY, 10) : 0,
  security: {
    lockoutThreshold: positiveInt(process.env.LOCKOUT_THRESHOLD, 5), // Failed logins for one email before it is locked.
    lockoutMinutes: positiveInt(process.env.LOCKOUT_MINUTES, 15), // How long the lock lasts (and the window failures are counted in).
    alertThreshold: positiveInt(process.env.SECURITY_ALERT_THRESHOLD, 10), // Suspicious events from one IP in the alert window before an alert fires.
    alertWindowMinutes: positiveInt(process.env.SECURITY_ALERT_WINDOW_MINUTES, 5),
  },
  isProduction: nodeEnv === 'production', // Convenience boolean flag used elsewhere (e.g. logging format).
  isTest: nodeEnv === 'test', // True under Jest - used to keep test output quiet.
  rateLimits: {
    // All limits are configurable so markers can tighten/loosen them without code changes.
    windowMs: positiveInt(process.env.RATE_LIMIT_WINDOW_MINUTES, 15) * 60 * 1000, // Rolling window shared by every limiter.
    loginMax: positiveInt(process.env.RATE_LIMIT_LOGIN_MAX, 10), // Failed login attempts per IP per window.
    registerMax: positiveInt(process.env.RATE_LIMIT_REGISTER_MAX, 20), // Registrations per IP per window.
    bookingMax: positiveInt(process.env.RATE_LIMIT_BOOKING_MAX, 10), // Bookings per user per window.
    apiMax: positiveInt(process.env.RATE_LIMIT_API_MAX, 300), // General API requests per IP per window.
  },
};
