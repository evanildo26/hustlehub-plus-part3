const { app, request, setupDB, clearDB, teardownDB, createUser, createGig } = require('./helpers');
const { TAX_TABLES, taxYearFor, calculateAnnualTax, buildTaxEstimate } = require('../src/services/taxService');

const T2027 = TAX_TABLES[2027];

describe('SARS tax calculation (2026/27 tables)', () => {
  test('income at the R99 000 threshold pays no tax after the primary rebate', () => {
    expect(calculateAnnualTax(99000, T2027).tax).toBe(0);
  });

  test('R300 000: 44 118 + 26% of the amount above 245 100, less the R17 820 rebate', () => {
    const result = calculateAnnualTax(300000, T2027);
    expect(result.taxBeforeRebates).toBe(58392); // 44 118 + 0.26 * 54 900
    expect(result.tax).toBe(40572);
    expect(result.marginalRate).toBe(0.26);
  });

  test('R1 000 000 lands in the 41% bracket', () => {
    const result = calculateAnnualTax(1000000, T2027);
    expect(result.tax).toBe(288293); // 259 783 + 0.41 * 113 000 - 17 820
    expect(result.marginalRate).toBe(0.41);
  });

  test('older taxpayers get the secondary and tertiary rebates', () => {
    expect(calculateAnnualTax(150000, T2027, '65to74').tax).toBe(0); // 27 000 - (17 820 + 9 765) < 0
    expect(calculateAnnualTax(400000, T2027, '75plus').tax).toBe(54403); // 79 998 + 0.31 * 16 900 = 85 237, less 30 834 in rebates
  });

  test('the bracket breakdown adds up to the tax before rebates', () => {
    const result = calculateAnnualTax(600000, T2027);
    const sum = result.breakdown.reduce((s, b) => s + b.taxInBracket, 0);
    expect(sum).toBeCloseTo(result.taxBeforeRebates, 0);
    expect(result.breakdown.filter((b) => b.isCurrent)).toHaveLength(1);
    expect(result.breakdown.at(-1).to).toBeNull(); // Top bracket has no upper limit (JSON-safe).
  });

  test('negative or missing income is treated as zero', () => {
    expect(calculateAnnualTax(-500, T2027).tax).toBe(0);
    expect(calculateAnnualTax(undefined, T2027).tax).toBe(0);
  });
});

describe('Tax year boundaries (1 March - end of February)', () => {
  test.each([
    ['2026-10-15', 2027],
    ['2026-03-01', 2027],
    ['2026-02-28', 2026],
    ['2027-01-10', 2027],
  ])('%s falls in the %i tax year', (date, year) => {
    expect(taxYearFor(new Date(`${date}T12:00:00Z`)).year).toBe(year);
  });
});

describe('buildTaxEstimate', () => {
  const now = new Date('2026-10-15T12:00:00Z'); // 8th month of the 2026/27 tax year (March..October).

  test('annualises year-to-date income and applies the effective rate', () => {
    const est = buildTaxEstimate({
      monthlyNet: [
        { month: '2026-03', netIncome: 100000 },
        { month: '2026-09', netIncome: 100000 },
      ],
      now,
    });
    expect(est.taxYear).toMatchObject({ label: '2026/27', start: '2026-03-01', end: '2027-02-28', monthsElapsed: 8 });
    expect(est.ytdIncome).toBe(200000);
    expect(est.projectedAnnualIncome).toBe(300000); // 200 000 / 8 * 12
    expect(est.estimatedAnnualTax).toBe(40572);
    expect(est.effectiveRate).toBeCloseTo(0.1352, 4);
    expect(est.setAsideSoFar).toBeCloseTo(27048, 0);
    expect(est.takeHomeSoFar + est.setAsideSoFar).toBeCloseTo(200000, 2);
  });

  test('returns 12 months, flags elapsed ones, and splits provisional tax into two payments', () => {
    const est = buildTaxEstimate({ monthlyNet: [{ month: '2026-04', netIncome: 50000 }], now });
    expect(est.months).toHaveLength(12);
    expect(est.months[0].month).toBe('2026-03');
    expect(est.months[11].month).toBe('2027-02');
    expect(est.months.filter((m) => m.elapsed)).toHaveLength(8);
    const [p1, p2] = est.provisionalTax;
    expect(p1.dueDate).toBe('2026-08-31');
    expect(p2.dueDate).toBe('2027-02-28');
    expect(p1.amount + p2.amount).toBeCloseTo(est.estimatedAnnualTax, 2);
  });

  test('low earners below the threshold owe nothing', () => {
    const est = buildTaxEstimate({ monthlyNet: [{ month: '2026-05', netIncome: 5000 }], now });
    expect(est.belowThreshold).toBe(true);
    expect(est.estimatedAnnualTax).toBe(0);
    expect(est.setAsideSoFar).toBe(0);
  });
});

describe('GET /api/income/tax-estimate', () => {
  beforeAll(setupDB);
  afterEach(clearDB);
  afterAll(teardownDB);

  const auth = (token) => ({ Authorization: `Bearer ${token}` });

  test("returns the freelancer's own estimate based on their net earnings", async () => {
    const freelancer = await createUser('freelancer');
    const other = await createUser('freelancer');
    const client = await createUser('client');
    const gig = await createGig(freelancer.token, { price: 1000 });
    await request(app).post('/api/bookings').set(auth(client.token)).send({ gigId: gig.id });

    const res = await request(app).get('/api/income/tax-estimate').set(auth(freelancer.token));
    expect(res.status).toBe(200);
    expect(res.body.data.ytdIncome).toBe(900); // 1000 less the 10% platform fee
    expect(res.body.data.months).toHaveLength(12);
    expect(res.body.data.disclaimer).toMatch(/estimate/i);

    const otherRes = await request(app).get('/api/income/tax-estimate').set(auth(other.token));
    expect(otherRes.body.data.ytdIncome).toBe(0); // Never sees someone else's income
  });

  test('refunds reduce taxable income', async () => {
    const freelancer = await createUser('freelancer');
    const client = await createUser('client');
    const gig = await createGig(freelancer.token, { price: 1000 });
    const { booking } = (await request(app).post('/api/bookings').set(auth(client.token)).send({ gigId: gig.id })).body.data;
    await request(app).patch(`/api/bookings/${booking.id}/cancel`).set(auth(client.token));

    const res = await request(app).get('/api/income/tax-estimate').set(auth(freelancer.token));
    expect(res.body.data.ytdIncome).toBe(0);
  });

  test('clients and anonymous users are refused; bad ageGroup is a 400', async () => {
    const client = await createUser('client');
    const freelancer = await createUser('freelancer');
    expect((await request(app).get('/api/income/tax-estimate')).status).toBe(401);
    expect((await request(app).get('/api/income/tax-estimate').set(auth(client.token))).status).toBe(403);
    const bad = await request(app).get('/api/income/tax-estimate?ageGroup=$gt').set(auth(freelancer.token));
    expect(bad.status).toBe(400);
    const ok = await request(app).get('/api/income/tax-estimate?ageGroup=65to74').set(auth(freelancer.token));
    expect(ok.status).toBe(200);
    expect(ok.body.data.rebate).toBe(17820 + 9765);
  });
});
