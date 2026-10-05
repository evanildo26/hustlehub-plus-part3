const jwt = require('jsonwebtoken');
const { app, request, setupDB, clearDB, teardownDB, createUser, PASSWORD } = require('./helpers');
const User = require('../src/models/userModel');

beforeAll(setupDB);
afterEach(clearDB);
afterAll(teardownDB);

const newUser = (overrides = {}) => ({
  name: 'Thandiwe Nkosi',
  email: 'thandiwe@example.com',
  password: PASSWORD,
  role: 'freelancer',
  ...overrides,
});

describe('POST /api/auth/register', () => {
  test('creates an account and never returns or stores the plain password', async () => {
    const res = await request(app).post('/api/auth/register').send(newUser());

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({ email: 'thandiwe@example.com', role: 'freelancer' });
    expect(res.body.data.password).toBeUndefined();

    const stored = await User.findOne({ email: 'thandiwe@example.com' }).select('+password');
    expect(stored.password).not.toBe(PASSWORD);
    expect(stored.password).toMatch(/^\$2[aby]\$12\$/); // bcrypt hash with cost factor 12
  });

  test('rejects a duplicate email with 409', async () => {
    await request(app).post('/api/auth/register').send(newUser());
    const res = await request(app).post('/api/auth/register').send(newUser({ name: 'Someone Else' }));
    expect(res.status).toBe(409);
  });

  test.each([
    ['weak password', { password: 'password' }, 'password'],
    ['invalid email', { email: 'not-an-email' }, 'email'],
    ['self-assigned admin role', { role: 'admin' }, 'role'],
    ['script in name', { name: '<script>alert(1)</script>' }, 'name'],
    ['missing name', { name: undefined }, 'name'],
  ])('rejects %s with 400', async (_label, override, field) => {
    const res = await request(app).post('/api/auth/register').send(newUser(override));
    expect(res.status).toBe(400);
    expect(res.body.errors.map((e) => e.field)).toContain(field);
  });

  test('rejects unexpected fields (mass assignment)', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...newUser(), isAdmin: true });
    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe('isAdmin');
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/api/auth/register').send(newUser());
  });

  test('returns a signed JWT with id and role claims', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'thandiwe@example.com', password: PASSWORD });

    expect(res.status).toBe(200);
    const decoded = jwt.decode(res.body.token, { complete: true });
    expect(decoded.header.alg).toBe('HS256');
    expect(decoded.payload).toMatchObject({ role: 'freelancer', iss: 'hustlehub-api', aud: 'hustlehub-client' });
    expect(decoded.payload.id).toBe(res.body.data.id);
    expect(decoded.payload.password).toBeUndefined();
  });

  test('uses the same generic 401 for wrong password and unknown email', async () => {
    const wrongPassword = await request(app).post('/api/auth/login').send({ email: 'thandiwe@example.com', password: 'Wrong123!' });
    const unknownUser = await request(app).post('/api/auth/login').send({ email: 'nobody@example.com', password: PASSWORD });

    expect(wrongPassword.status).toBe(401);
    expect(unknownUser.status).toBe(401);
    expect(wrongPassword.body.message).toBe(unknownUser.body.message);
  });

  test('blocks NoSQL operator injection in credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: { $ne: null }, password: { $ne: null } });
    expect(res.status).toBe(400);
    expect(res.body.token).toBeUndefined();
  });
});

describe('JWT-protected route GET /api/users/me', () => {
  test('returns 401 without a token', async () => {
    const res = await request(app).get('/api/users/me');
    expect(res.status).toBe(401);
  });

  test('returns the profile with a valid token', async () => {
    const { user, token } = await createUser('client');
    const res = await request(app).get('/api/users/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(user.id);
  });

  test('rejects a token signed with a different secret', async () => {
    const { user } = await createUser('client');
    const forged = jwt.sign({ id: user.id, role: 'admin' }, 'attacker-secret-attacker-secret-123', {
      issuer: 'hustlehub-api',
      audience: 'hustlehub-client',
    });
    const res = await request(app).get('/api/users/me').set('Authorization', `Bearer ${forged}`);
    expect(res.status).toBe(401);
  });

  test('rejects an unsigned "alg: none" token', async () => {
    const { user } = await createUser('client');
    const unsigned = jwt.sign({ id: user.id, role: 'admin' }, null, { algorithm: 'none' });
    const res = await request(app).get('/api/users/me').set('Authorization', `Bearer ${unsigned}`);
    expect(res.status).toBe(401);
  });
});
