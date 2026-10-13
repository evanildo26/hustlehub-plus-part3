const { app, request, setupDB, clearDB, teardownDB, createUser, createGig, validGig } = require('./helpers');

beforeAll(setupDB);
afterEach(clearDB);
afterAll(teardownDB);

const auth = (token) => ({ Authorization: `Bearer ${token}` });

describe('Gig creation (RBAC + validation)', () => {
  test('a freelancer can create a gig and is recorded as its owner', async () => {
    const { user, token } = await createUser('freelancer');
    const res = await request(app).post('/api/gigs').set(auth(token)).send(validGig());
    expect(res.status).toBe(201);
    expect(res.body.data.freelancer).toBe(user.id);
  });

  test('a client cannot create a gig (403)', async () => {
    const { token } = await createUser('client');
    const res = await request(app).post('/api/gigs').set(auth(token)).send(validGig());
    expect(res.status).toBe(403);
  });

  test('an anonymous user cannot create a gig (401)', async () => {
    const res = await request(app).post('/api/gigs').send(validGig());
    expect(res.status).toBe(401);
  });

  test('HTML is stripped from free text before saving (stored XSS)', async () => {
    const { token } = await createUser('freelancer');
    const gig = await createGig(token, {
      title: 'Logo <img src=x onerror=alert(1)> design',
      description: 'Great design work <script>steal()</script> delivered quickly and professionally.',
    });
    expect(gig.title).toBe('Logo design');
    expect(gig.description).not.toMatch(/<|>/);
  });

  test('cannot set the owner field via the body (mass assignment)', async () => {
    const { token } = await createUser('freelancer');
    const { user: victim } = await createUser('freelancer');
    const res = await request(app).post('/api/gigs').set(auth(token)).send({ ...validGig(), freelancer: victim.id });
    expect(res.status).toBe(400);
  });

  test.each([
    ['price below minimum', { price: 10 }, 'price'],
    ['price with 3 decimals', { price: 100.555 }, 'price'],
    ['unknown category', { category: 'hacking' }, 'category'],
    ['delivery of 0 days', { deliveryDays: 0 }, 'deliveryDays'],
    ['too-short title', { title: 'abc' }, 'title'],
  ])('rejects %s', async (_label, override, field) => {
    const { token } = await createUser('freelancer');
    const res = await request(app).post('/api/gigs').set(auth(token)).send(validGig(override));
    expect(res.status).toBe(400);
    expect(res.body.errors.map((e) => e.field)).toContain(field);
  });
});

describe('Gig ownership', () => {
  test('a freelancer cannot update another freelancer\'s gig (403)', async () => {
    const owner = await createUser('freelancer');
    const other = await createUser('freelancer');
    const gig = await createGig(owner.token);

    const res = await request(app).patch(`/api/gigs/${gig.id}`).set(auth(other.token)).send({ price: 50 });
    expect(res.status).toBe(403);
  });

  test('the owner can update and deactivate their gig', async () => {
    const owner = await createUser('freelancer');
    const gig = await createGig(owner.token);

    const res = await request(app).patch(`/api/gigs/${gig.id}`).set(auth(owner.token)).send({ price: 1250.5, isActive: false });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ price: 1250.5, isActive: false });
  });

  test('a freelancer cannot delete another freelancer\'s gig, but an admin can', async () => {
    const owner = await createUser('freelancer');
    const other = await createUser('freelancer');
    const admin = await createUser('admin');
    const gig = await createGig(owner.token);

    expect((await request(app).delete(`/api/gigs/${gig.id}`).set(auth(other.token))).status).toBe(403);
    expect((await request(app).delete(`/api/gigs/${gig.id}`).set(auth(admin.token))).status).toBe(200);
  });

  test('GET /api/gigs/mine only returns the caller\'s gigs', async () => {
    const a = await createUser('freelancer');
    const b = await createUser('freelancer');
    await createGig(a.token);
    await createGig(b.token);

    const res = await request(app).get('/api/gigs/mine').set(auth(a.token));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].freelancer).toBe(a.user.id);
  });
});

describe('Public browsing', () => {
  test('lists only active gigs and hides freelancer emails', async () => {
    const { token } = await createUser('freelancer');
    await createGig(token, { title: 'Visible active gig' });
    await createGig(token, { title: 'Hidden inactive gig', isActive: false });

    const res = await request(app).get('/api/gigs');
    expect(res.status).toBe(200);
    expect(res.body.data.map((g) => g.title)).toEqual(['Visible active gig']);
    expect(res.body.data[0].freelancer.email).toBeUndefined();
  });

  test('search treats regex characters literally', async () => {
    const { token } = await createUser('freelancer');
    await createGig(token);
    const res = await request(app).get('/api/gigs').query({ search: '.*' });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0); // ".*" would match everything if it were used as a raw regex.
  });

  test('category counts include only active gigs and every category', async () => {
    const { token } = await createUser('freelancer');
    await createGig(token);
    await createGig(token, { title: 'Hidden design gig', isActive: false });
    await createGig(token, { category: 'writing', title: 'Blog writing service' });

    const res = await request(app).get('/api/gigs/categories');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(8);
    expect(res.body.data.find((c) => c.category === 'design').count).toBe(1);
    expect(res.body.data.find((c) => c.category === 'writing').count).toBe(1);
    expect(res.body.total).toBe(2);
  });

  test('an invalid gig id returns 400, a missing one 404', async () => {
    expect((await request(app).get('/api/gigs/not-an-id')).status).toBe(400);
    expect((await request(app).get('/api/gigs/65a000000000000000000000')).status).toBe(404);
  });
});

describe('Price format (money amounts)', () => {
  test.each([
    ['1500', 201],
    ['1500.5', 201],
    ['1500.50', 201],
    ['1e3', 400],
    ['1500.505', 400],
    ['12.', 400],
    ['1.2.3', 400],
  ])('price %s -> %i', async (price, status) => {
    const { token } = await createUser('freelancer');
    const res = await request(app).post('/api/gigs').set('Authorization', `Bearer ${token}`).send(validGig({ price }));
    expect(res.status).toBe(status);
  });
});
