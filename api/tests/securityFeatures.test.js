/**
 * Part 3 security features: account lockout, token revocation (logout and
 * admin "revoke sessions"), security monitoring/alerts, request ids and
 * log redaction.
 */
const jwt = require('jsonwebtoken');
const { app, request, setupDB, clearDB, teardownDB, createUser, PASSWORD } = require('./helpers');
const logger = require('../src/utils/logger');
const SecurityEvent = require('../src/models/securityEventModel');
const { resetMonitorState } = require('../src/services/securityMonitor');

beforeAll(setupDB);
afterEach(async () => {
  await clearDB();
  resetMonitorState();
});
afterAll(teardownDB);

const auth = (token) => ({ Authorization: `Bearer ${token}` });
const login = (email, password) => request(app).post('/api/auth/login').send({ email, password });

/** Security events are stored asynchronously - wait until the expected rows exist. */
async function waitForEvents(filter, atLeast = 1) {
  for (let i = 0; i < 40; i += 1) {
    if ((await SecurityEvent.countDocuments(filter)) >= atLeast) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`Timed out waiting for ${atLeast} x ${JSON.stringify(filter)}`);
}

describe('Account lockout (per email)', () => {
  test('5 wrong passwords lock the account, and even the right password is refused while locked', async () => {
    const { user } = await createUser('client');
    for (let i = 1; i <= 4; i += 1) expect((await login(user.email, 'WrongPass1!')).status).toBe(401);

    const fifth = await login(user.email, 'WrongPass1!');
    expect(fifth.status).toBe(423);
    expect(fifth.body.message).toMatch(/try again in 15 minutes/);
    expect(fifth.headers['retry-after']).toBe('900');

    const correct = await login(user.email, PASSWORD);
    expect(correct.status).toBe(423);
    expect(correct.body.token).toBeUndefined();
  });

  test('unknown emails lock in exactly the same way, so lockout reveals nothing about accounts', async () => {
    const realUser = (await createUser('client')).user;
    const responses = { real: null, fake: null };
    for (let i = 0; i < 5; i += 1) {
      responses.real = await login(realUser.email, 'WrongPass1!');
      responses.fake = await login('nobody-here@test.local', 'WrongPass1!');
    }
    expect(responses.fake.status).toBe(responses.real.status);
    expect(responses.fake.body).toEqual(responses.real.body);
  });

  test('a successful login resets the failure counter', async () => {
    const { user } = await createUser('client');
    for (let i = 0; i < 4; i += 1) await login(user.email, 'WrongPass1!');
    expect((await login(user.email, PASSWORD)).status).toBe(200);
    for (let i = 0; i < 4; i += 1) expect((await login(user.email, 'WrongPass1!')).status).toBe(401);
  });

  test('locking an account is logged as ACCOUNT_LOCKED with a masked email', async () => {
    const { user } = await createUser('client');
    for (let i = 0; i < 5; i += 1) await login(user.email, 'WrongPass1!');
    await waitForEvents({ event: 'ACCOUNT_LOCKED' });
    const event = await SecurityEvent.findOne({ event: 'ACCOUNT_LOCKED' }).lean();
    expect(event.details.email).toMatch(/^\w{2}\*\*\*@test\.local$/);
    expect(event.details.email).not.toBe(user.email);
  });
});

describe('Token revocation', () => {
  test('logout revokes that token immediately; other sessions keep working', async () => {
    const { user } = await createUser('freelancer');
    const tokenA = (await login(user.email, PASSWORD)).body.token;
    const tokenB = (await login(user.email, PASSWORD)).body.token;

    expect((await request(app).get('/api/users/me').set(auth(tokenA))).status).toBe(200);
    const out = await request(app).post('/api/auth/logout').set(auth(tokenA));
    expect(out.status).toBe(200);

    const reuse = await request(app).get('/api/users/me').set(auth(tokenA));
    expect(reuse.status).toBe(401);
    expect(reuse.body.message).toBe('Your session has ended. Please log in again.');
    expect((await request(app).get('/api/users/me').set(auth(tokenB))).status).toBe(200);
  });

  test('logout requires a valid token', async () => {
    expect((await request(app).post('/api/auth/logout')).status).toBe(401);
  });

  test('an admin can revoke every session of a user; the user can log in again afterwards', async () => {
    const admin = await createUser('admin');
    const { user } = await createUser('client');
    const token = (await login(user.email, PASSWORD)).body.token;

    const res = await request(app).post(`/api/admin/users/${user.id}/revoke-sessions`).set(auth(admin.token));
    expect(res.status).toBe(200);
    expect((await request(app).get('/api/users/me').set(auth(token))).status).toBe(401);

    const fresh = (await login(user.email, PASSWORD)).body.token;
    expect((await request(app).get('/api/users/me').set(auth(fresh))).status).toBe(200);
  });

  test('only admins can revoke sessions; ids are validated', async () => {
    const admin = await createUser('admin');
    const client = await createUser('client');
    const url = (id) => `/api/admin/users/${id}/revoke-sessions`;
    expect((await request(app).post(url(admin.user.id)).set(auth(client.token))).status).toBe(403);
    expect((await request(app).post(url('not-an-id')).set(auth(admin.token))).status).toBe(400);
    expect((await request(app).post(url('65a000000000000000000099')).set(auth(admin.token))).status).toBe(404);
  });

  test('a correctly signed token without a jti is rejected', async () => {
    const { user } = await createUser('client');
    const legacy = jwt.sign({ id: user.id, role: 'client', email: user.email }, process.env.JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: '1h',
      issuer: 'hustlehub-api',
      audience: 'hustlehub-client',
    });
    expect((await request(app).get('/api/users/me').set(auth(legacy))).status).toBe(401);
  });
});

describe('Security monitoring', () => {
  test('repeated failures from one IP raise a single BRUTE_FORCE_LOGIN alert', async () => {
    for (let i = 0; i < 12; i += 1) await login(`victim${i}@test.local`, 'WrongPass1!');
    await waitForEvents({ event: 'SECURITY_ALERT' });

    const alerts = await SecurityEvent.find({ event: 'SECURITY_ALERT' }).lean();
    expect(alerts).toHaveLength(1); // One alert per window, not one per failure.
    expect(alerts[0].level).toBe('alert');
    expect(alerts[0].details).toMatchObject({ pattern: 'BRUTE_FORCE_LOGIN', windowMinutes: 5 });
    expect(alerts[0].details.eventCount).toBeGreaterThanOrEqual(10);
  });

  test('admins see a summary of recent security events; other roles get 403', async () => {
    const admin = await createUser('admin');
    const client = await createUser('client');
    await login('someone@test.local', 'WrongPass1!');
    await login('someone@test.local', 'WrongPass1!');
    await request(app).get('/api/admin/stats').set(auth(client.token)); // ACCESS_DENIED
    await waitForEvents({ event: 'LOGIN_FAILED' }, 2);
    await waitForEvents({ event: 'ACCESS_DENIED' });

    const res = await request(app).get('/api/admin/security-events?hours=24').set(auth(admin.token));
    expect(res.status).toBe(200);
    expect(res.body.data.totals).toMatchObject({ failedLogins: 2, accessDenied: 1 });
    expect(res.body.data.recentEvents.length).toBeGreaterThanOrEqual(3);
    expect(res.body.data.topIps[0].count).toBeGreaterThanOrEqual(2);

    expect((await request(app).get('/api/admin/security-events').set(auth(client.token))).status).toBe(403);
    expect((await request(app).get('/api/admin/security-events?hours=$gt').set(auth(admin.token))).status).toBe(400);
  });
});

describe('Request ids and log hygiene', () => {
  test('every response carries an X-Request-Id that matches the logged entries', async () => {
    const seen = [];
    logger.addSink((entry) => seen.push(entry));
    const res = await login('trace-me@test.local', 'WrongPass1!');

    const id = res.headers['x-request-id'];
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(seen.find((e) => e.event === 'LOGIN_FAILED').requestId).toBe(id);
  });

  test('a safe incoming request id is kept; an unsafe one is replaced', async () => {
    const safe = await request(app).get('/api/health').set('X-Request-Id', 'proxy-abc-12345');
    expect(safe.headers['x-request-id']).toBe('proxy-abc-12345');
    const unsafe = await request(app).get('/api/health').set('X-Request-Id', '<script>INJECTED</script>'.repeat(5));
    expect(unsafe.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/); // Replaced with a fresh UUID.
  });

  test('secret-looking fields are redacted and emails masked before anything is logged', () => {
    const out = logger.redact({ password: 'Hunter2!', nested: { accessToken: 'abc', authorization: 'Bearer x' }, name: 'Sipho' });
    expect(out).toEqual({ password: '[REDACTED]', nested: { accessToken: '[REDACTED]', authorization: '[REDACTED]' }, name: 'Sipho' });
    expect(logger.maskEmail('thandiwe@demo.hustlehub.local')).toBe('th***@demo.hustlehub.local');
    expect(logger.maskEmail('not-an-email')).toBeUndefined();
  });
});
