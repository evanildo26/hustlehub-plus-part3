/**
 * Tax estimation for freelancers (South African personal income tax).
 *
 * Freelancers on HustleHub+ are sole proprietors, so SARS taxes their
 * platform income at the normal individual rates and they pay it in advance
 * as provisional tax (two payments: end of August and end of February).
 *
 * How the estimate is worked out:
 *   1. Taxable income so far = the freelancer's NET earnings (after the 10%
 *      platform fee, net of refunds) inside the current tax year. The fee is
 *      never received by the freelancer, so it is not part of their income.
 *   2. That year-to-date income is annualised:
 *        projected = ytd / months elapsed in the tax year * 12
 *      because SARS tax is charged on a full year's income, and a freelancer
 *      half-way through the year needs to know which bracket they are
 *      heading for, not the bracket their first few months fall into.
 *   3. Annual tax = bracket formula from the SARS table for that tax year,
 *      minus the rebate(s) for the freelancer's age group, never below 0.
 *   4. Effective rate = annual tax / projected income. Applying it to the
 *      year-to-date income gives "set aside so far": the slice of what they
 *      have already earned that they should keep for SARS.
 *
 * Simplifications (shown to the user on the dashboard as well): income from
 * outside HustleHub+, deductible business expenses, retirement-fund
 * contributions and medical tax credits are not included, so this is an
 * estimate for planning, not a tax return.
 *
 * Source: SARS, "Rates of Tax for Individuals" (2026 and 2027 tax years).
 */

/** SARS tax tables. Each bracket: income up to `upTo` is taxed at `base + rate * (income - over)`. */
const TAX_TABLES = {
  2026: {
    label: '2025/26',
    start: '2025-03-01',
    end: '2026-02-28',
    brackets: [
      { upTo: 237100, rate: 0.18, base: 0, over: 0 },
      { upTo: 370500, rate: 0.26, base: 42678, over: 237100 },
      { upTo: 512800, rate: 0.31, base: 77362, over: 370500 },
      { upTo: 673000, rate: 0.36, base: 121475, over: 512800 },
      { upTo: 857900, rate: 0.39, base: 179147, over: 673000 },
      { upTo: 1817000, rate: 0.41, base: 251258, over: 857900 },
      { upTo: Infinity, rate: 0.45, base: 644489, over: 1817000 },
    ],
    rebates: { primary: 17235, secondary: 9444, tertiary: 3145 },
    thresholds: { under65: 95750, '65to74': 148217, '75plus': 165689 },
  },
  2027: {
    label: '2026/27',
    start: '2026-03-01',
    end: '2027-02-28',
    brackets: [
      { upTo: 245100, rate: 0.18, base: 0, over: 0 },
      { upTo: 383100, rate: 0.26, base: 44118, over: 245100 },
      { upTo: 530200, rate: 0.31, base: 79998, over: 383100 },
      { upTo: 695800, rate: 0.36, base: 125599, over: 530200 },
      { upTo: 887000, rate: 0.39, base: 185215, over: 695800 },
      { upTo: 1878600, rate: 0.41, base: 259783, over: 887000 },
      { upTo: Infinity, rate: 0.45, base: 666339, over: 1878600 },
    ],
    rebates: { primary: 17820, secondary: 9765, tertiary: 3249 },
    thresholds: { under65: 99000, '65to74': 153250, '75plus': 171300 },
  },
};

const AGE_GROUPS = ['under65', '65to74', '75plus'];
const LATEST_TABLE_YEAR = Math.max(...Object.keys(TAX_TABLES).map(Number));

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * SA tax years run 1 March - end of February and are named by the year they
 * END in: 15 Oct 2026 falls in the "2027" tax year (1 Mar 2026 - 28 Feb 2027).
 */
function taxYearFor(date = new Date()) {
  const year = date.getUTCFullYear();
  const endYear = date.getUTCMonth() >= 2 ? year + 1 : year; // getUTCMonth: 0 = Jan, 2 = March.
  return {
    year: endYear,
    start: new Date(Date.UTC(endYear - 1, 2, 1)), // 1 March
    end: new Date(Date.UTC(endYear, 2, 1)), // exclusive: 1 March of the following year
  };
}

/**
 * The table for a tax year. A year newer than the latest published table
 * falls back to the latest one (SARS publishes new tables each February).
 */
function tableFor(taxYear) {
  return TAX_TABLES[taxYear] || TAX_TABLES[Math.min(taxYear, LATEST_TABLE_YEAR)] || TAX_TABLES[LATEST_TABLE_YEAR];
}

/** Total rebate for an age group (65+ adds the secondary rebate, 75+ also the tertiary one). */
function rebateFor(table, ageGroup = 'under65') {
  const { primary, secondary, tertiary } = table.rebates;
  if (ageGroup === '75plus') return primary + secondary + tertiary;
  if (ageGroup === '65to74') return primary + secondary;
  return primary;
}

/**
 * Annual income tax on `taxableIncome` using a SARS table.
 * Returns the tax before and after rebates plus a per-bracket breakdown
 * (how much of the income falls in each bracket and the tax it attracts).
 */
function calculateAnnualTax(taxableIncome, table, ageGroup = 'under65') {
  const income = Math.max(0, Number(taxableIncome) || 0);
  const bracketIndex = table.brackets.findIndex((b) => income <= b.upTo);
  const bracket = table.brackets[bracketIndex];
  const taxBeforeRebates = bracket.base + bracket.rate * (income - bracket.over);
  const rebate = rebateFor(table, ageGroup);
  const tax = Math.max(0, taxBeforeRebates - rebate);

  const breakdown = table.brackets.map((b, i) => {
    const from = b.over;
    const to = b.upTo;
    const incomeInBracket = Math.max(0, Math.min(income, to) - from);
    return {
      from,
      to: Number.isFinite(to) ? to : null, // JSON has no Infinity - null means "and above".
      rate: b.rate,
      incomeInBracket: round2(incomeInBracket),
      taxInBracket: round2(incomeInBracket * b.rate),
      isCurrent: i === bracketIndex,
    };
  });

  return {
    taxBeforeRebates: round2(taxBeforeRebates),
    rebate,
    tax: round2(tax),
    marginalRate: tax > 0 ? bracket.rate : 0, // Below the threshold an extra rand attracts no tax.
    effectiveRate: income > 0 ? tax / income : 0,
    breakdown,
  };
}

/** Whole months of the tax year that have started by `now` (1-12). */
function monthsElapsed(taxYear, now) {
  const months =
    (now.getUTCFullYear() - taxYear.start.getUTCFullYear()) * 12 + (now.getUTCMonth() - taxYear.start.getUTCMonth()) + 1;
  return Math.min(12, Math.max(1, months));
}

/**
 * Builds the full estimate from a freelancer's net earnings per month of the
 * tax year. `monthlyNet` is [{ month: 'YYYY-MM', netIncome }] (any order,
 * months with no income may be omitted).
 */
function buildTaxEstimate({ monthlyNet, now = new Date(), ageGroup = 'under65' }) {
  const taxYear = taxYearFor(now);
  const table = tableFor(taxYear.year);
  const elapsed = monthsElapsed(taxYear, now);

  const byMonth = new Map(monthlyNet.map((m) => [m.month, m.netIncome]));
  const ytdIncome = round2(monthlyNet.reduce((sum, m) => sum + m.netIncome, 0));
  const projectedAnnualIncome = round2((ytdIncome / elapsed) * 12);

  const annual = calculateAnnualTax(projectedAnnualIncome, table, ageGroup);
  const setAsideSoFar = round2(Math.max(0, ytdIncome) * annual.effectiveRate);

  // Every month of the tax year, so the chart has a stable 12-slot axis.
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(taxYear.start.getUTCFullYear(), taxYear.start.getUTCMonth() + i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    const netIncome = round2(byMonth.get(key) || 0);
    const estimatedTax = round2(Math.max(0, netIncome) * annual.effectiveRate);
    return { month: key, netIncome, estimatedTax, afterTax: round2(netIncome - estimatedTax), elapsed: i < elapsed };
  });

  // Provisional tax (IRP6): half of the annual estimate by 31 August, the
  // balance by the last day of February.
  const lastDay = new Date(taxYear.end.getTime() - 86400000).toISOString().slice(0, 10); // Last day of February (leap-year safe).
  const firstPayment = round2(annual.tax / 2);
  const provisionalTax = [
    { period: 1, dueDate: `${taxYear.year - 1}-08-31`, amount: firstPayment },
    { period: 2, dueDate: lastDay, amount: round2(annual.tax - firstPayment) },
  ];

  const threshold = table.thresholds[ageGroup];

  return {
    currency: 'ZAR',
    taxYear: {
      label: table.label,
      start: taxYear.start.toISOString().slice(0, 10),
      end: lastDay,
      monthsElapsed: elapsed,
    },
    ageGroup,
    ytdIncome,
    projectedAnnualIncome,
    estimatedAnnualTax: annual.tax,
    taxBeforeRebates: annual.taxBeforeRebates,
    rebate: annual.rebate,
    effectiveRate: Math.round(annual.effectiveRate * 10000) / 10000, // e.g. 0.1234 = 12.34%
    marginalRate: annual.marginalRate,
    setAsideSoFar,
    takeHomeSoFar: round2(ytdIncome - setAsideSoFar),
    taxThreshold: threshold,
    belowThreshold: projectedAnnualIncome <= threshold,
    brackets: annual.breakdown,
    months,
    provisionalTax,
    method: [
      'Taxable income is your net HustleHub+ earnings (after the 10% platform fee and refunds) in the current tax year.',
      `Year-to-date income is annualised (divided by ${elapsed} month${elapsed === 1 ? '' : 's'} elapsed, multiplied by 12) to project a full year.`,
      `Tax on the projection uses the SARS ${table.label} individual tax brackets, less the rebate for your age group.`,
      'The effective rate (tax / projected income) is applied to each month to show how much to set aside.',
    ],
    disclaimer:
      'Estimate for planning only. It excludes income from outside HustleHub+, deductible expenses, retirement contributions and medical tax credits. Confirm your provisional tax with SARS or a registered tax practitioner.',
  };
}

module.exports = {
  TAX_TABLES,
  AGE_GROUPS,
  taxYearFor,
  tableFor,
  calculateAnnualTax,
  buildTaxEstimate,
};
