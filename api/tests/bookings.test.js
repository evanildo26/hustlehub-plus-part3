const { app, request, setupDB, clearDB, teardownDB, createUser, createGig } = require('./helpers');
const Transaction = require('../src/models/transactionModel');

beforeAll(setupDB);
afterEach(clearDB);
afterAll(teardownDB);

const auth = (token) => ({ Authorization: `Bearer ${token}` });

async function bookingFixture() {
  const freelancer = await createUser('freelancer');
  const client = await createUser('client');
  const gig = await createGig(freelancer.token, { price: 1000 });
  return { freelancer, client, gig };
}

async function book(clientToken, gigId) {
  return request(app).post('/api/bookings').set(auth(clientToken)).send({ gigId, notes: 'Blue and white please' });
}

describe('Creating bookings', () => {
  test('a client booking creates a confirmed booking and a payment transaction', async () => {
    const { freelancer, client, gig } = await bookingFixture();
    const res = await book(client.token, gig.id);

    expect(res.status).toBe(201);
    const { booking, transaction } = res.body.data;
    expect(booking).toMatchObject({ status: 'confirmed', amount: 1000, client: client.user.id, freelancer: freelancer.user.id });
    expect(booking.paymentReference).toMatch(/^SIM-PAY-/);
    expect(transaction).toMatchObject({ type: 'payment', amount: 1000, platformFee: 100, freelancerEarnings: 900 });
    expect(await Transaction.countDocuments({ booking: booking.id })).toBe(1);
  });

  test('a freelancer cannot book gigs (403)', async () => {
    const { freelancer, gig } = await bookingFixture();
    expect((await book(freelancer.token, gig.id)).status).toBe(403);
  });

  test('a client cannot choose the amount they pay', async () => {
    const { client, gig } = await bookingFixture();
    const res = await request(app).post('/api/bookings').set(auth(client.token)).send({ gigId: gig.id, amount: 1 });
    expect(res.status).toBe(400);
  });

  test('an inactive gig cannot be booked', async () => {
    const { freelancer, client, gig } = await bookingFixture();
    await request(app).patch(`/api/gigs/${gig.id}`).set(auth(freelancer.token)).send({ isActive: false });
    expect((await book(client.token, gig.id)).status).toBe(404);
  });
});

describe('Booking access control', () => {
  test('each party sees the booking; an unrelated client gets 403', async () => {
    const { freelancer, client, gig } = await bookingFixture();
    const outsider = await createUser('client');
    const { booking } = (await book(client.token, gig.id)).body.data;

    expect((await request(app).get(`/api/bookings/${booking.id}`).set(auth(client.token))).status).toBe(200);
    expect((await request(app).get(`/api/bookings/${booking.id}`).set(auth(freelancer.token))).status).toBe(200);
    expect((await request(app).get(`/api/bookings/${booking.id}`).set(auth(outsider.token))).status).toBe(403);
  });

  test('booking lists are scoped to the caller', async () => {
    const { freelancer, client, gig } = await bookingFixture();
    const otherClient = await createUser('client');
    await book(client.token, gig.id);

    expect((await request(app).get('/api/bookings').set(auth(client.token))).body.data).toHaveLength(1);
    expect((await request(app).get('/api/bookings').set(auth(freelancer.token))).body.data).toHaveLength(1);
    expect((await request(app).get('/api/bookings').set(auth(otherClient.token))).body.data).toHaveLength(0);
  });

  test('only the booked freelancer can complete a booking', async () => {
    const { freelancer, client, gig } = await bookingFixture();
    const { booking } = (await book(client.token, gig.id)).body.data;

    expect((await request(app).patch(`/api/bookings/${booking.id}/complete`).set(auth(client.token))).status).toBe(403);
    const res = await request(app).patch(`/api/bookings/${booking.id}/complete`).set(auth(freelancer.token));
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('completed');

    // A completed booking can no longer be cancelled.
    expect((await request(app).patch(`/api/bookings/${booking.id}/cancel`).set(auth(client.token))).status).toBe(409);
  });
});

describe('Transactions and income', () => {
  test('cancelling records a refund and income nets back to zero', async () => {
    const { freelancer, client, gig } = await bookingFixture();
    const { booking } = (await book(client.token, gig.id)).body.data;

    const cancel = await request(app).patch(`/api/bookings/${booking.id}/cancel`).set(auth(client.token));
    expect(cancel.status).toBe(200);
    expect(cancel.body.data.refund).toMatchObject({ type: 'refund', amount: -1000, freelancerEarnings: -900 });

    const income = await request(app).get('/api/income/summary').set(auth(freelancer.token));
    expect(income.body.data).toMatchObject({ grossIncome: 0, netIncome: 0, payments: 1, refunds: 1 });
  });

  test('income is attributed to the correct freelancer only', async () => {
    const { freelancer, client, gig } = await bookingFixture();
    const otherFreelancer = await createUser('freelancer');
    await book(client.token, gig.id);
    await book(client.token, gig.id);

    const mine = await request(app).get('/api/income/summary').set(auth(freelancer.token));
    expect(mine.body.data).toMatchObject({ grossIncome: 2000, platformFees: 200, netIncome: 1800 });
    expect(mine.body.data.monthly).toHaveLength(1);

    const theirs = await request(app).get('/api/income/summary').set(auth(otherFreelancer.token));
    expect(theirs.body.data.netIncome).toBe(0);
  });

  test('clients cannot access the income summary', async () => {
    const { client } = await bookingFixture();
    expect((await request(app).get('/api/income/summary').set(auth(client.token))).status).toBe(403);
  });

  test('transactions are scoped per user and visible in full to admins', async () => {
    const { client, gig } = await bookingFixture();
    const outsider = await createUser('client');
    const admin = await createUser('admin');
    await book(client.token, gig.id);

    expect((await request(app).get('/api/transactions').set(auth(client.token))).body.data).toHaveLength(1);
    expect((await request(app).get('/api/transactions').set(auth(outsider.token))).body.data).toHaveLength(0);
    expect((await request(app).get('/api/transactions').set(auth(admin.token))).body.data).toHaveLength(1);
  });
});

describe('Admin endpoints', () => {
  test('only admins can list users, and password hashes are never included', async () => {
    const { client } = await bookingFixture();
    const admin = await createUser('admin');

    expect((await request(app).get('/api/admin/users').set(auth(client.token))).status).toBe(403);
    const res = await request(app).get('/api/admin/users').set(auth(admin.token));
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(3);
    res.body.data.forEach((u) => expect(u.password).toBeUndefined());
  });
});
