/**
 * Runs before every test file (see setupFiles in vitest.config.mjs).
 * Points the app at a SEPARATE test database so tests never touch real
 * data, and raises the rate limits so the suite isn't throttled by itself
 * (the limiter behaviour has its own dedicated test in security.test.js).
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET_TEST || 'test-secret-that-is-long-enough-for-the-32-char-minimum';
process.env.MONGO_URI = process.env.MONGO_URI_TEST || 'mongodb://127.0.0.1:27017/hustlehub_test';
process.env.RATE_LIMIT_LOGIN_MAX = '1000';
process.env.RATE_LIMIT_REGISTER_MAX = '1000';
process.env.RATE_LIMIT_BOOKING_MAX = '1000';
process.env.RATE_LIMIT_API_MAX = '10000';
