/**
 * Tests the rate limiters the app ACTUALLY uses, on the real routes, at the
 * production defaults (10 failed logins per IP, 10 bookings per user, per
 * 15 minutes). setupEnv.js raises every limit for the rest of the suite, so
 * this file puts the real values back BEFORE the app is loaded. Vitest runs
 * each test file in its own module context, so this does not leak into
 * other files.
 */
process.env.RATE_LIMIT_LOGIN_MAX = '10';
process.env.RATE_LIMIT_BOOKING_MAX = '10';

const { app, request, setupDB, teardownDB, createUser, createGig, PASSWORD } = require('./helpers');

beforeAll(setupDB);
afterAll(teardownDB);

const auth = (token) => ({ Authorization: `Bearer ${token}` });
const login = (email, password) => request(app).post('/api/auth/login').send({ email, password });

// Each failure uses a different email so the per-account lockout (423 after 5) never kicks in - this isolates the per-IP limiter.
let failures = 0;
const failLogin = () => {
  failures += 1;
  return login(`nobody${failures}@test.local`, 'WrongPass1!');
};

describe('Login limiter (real route, 10 failed attempts per IP)', () => {
  test('successful logins do not use up the budget; the 11th failure gets a 429', async () => {
    const { user } = await createUser('client');

    for (let i = 1; i <= 9; i += 1) expect((await failLogin()).status).toBe(401);

    // Successful logins in the middle are refunded, so they must not push this IP over the limit.
    for (let i = 0; i < 3; i += 1) expect((await login(user.email, PASSWORD)).status).toBe(200);

    expect((await failLogin()).status).toBe(401); // 10th failure: still allowed.

    const blocked = await failLogin(); // 11th failure: over the limit.
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({
      success: false,
      message: 'Too many failed login attempts. Please wait 15 minutes before trying again.',
      retryAfterSeconds: 900,
    });
    expect(blocked.headers['retry-after']).toBe('900');
    expect(blocked.headers['ratelimit-policy']).toMatch(/^10;w=900/);

    // Once blocked, the IP is refused even with the right password, and no token is issued.
    const correctWhileBlocked = await login(user.email, PASSWORD);
    expect(correctWhileBlocked.status).toBe(429);
    expect(correctWhileBlocked.body.token).toBeUndefined();
  });
});

describe('Booking limiter (real route, 10 bookings per user)', () => {
  test('the 11th booking from one user gets a 429; another user is not affected', async () => {
    const freelancer = await createUser('freelancer');
    const client = await createUser('client');
    const otherClient = await createUser('client');
    const gig = await createGig(freelancer.token);
    const book = (token) => request(app).post('/api/bookings').set(auth(token)).send({ gigId: gig.id });

    for (let i = 1; i <= 10; i += 1) expect((await book(client.token)).status).toBe(201);

    const blocked = await book(client.token);
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({
      success: false,
      message: 'You are making bookings too quickly. Please wait a few minutes and try again.',
      retryAfterSeconds: 900,
    });
    expect(blocked.headers['retry-after']).toBe('900');

    // Keyed per user, not per IP: a second account on the same IP can still book.
    expect((await book(otherClient.token)).status).toBe(201);
  });
});
