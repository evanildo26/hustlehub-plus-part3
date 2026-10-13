import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import EarningsPage from '../pages/EarningsPage';
import TaxBracketBars from '../components/charts/TaxBracketBars';
import { api, ApiError } from '../api/client';

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, api: { incomeSummary: vi.fn(), taxEstimate: vi.fn() } };
});

const month = (m, netIncome, estimatedTax, elapsed = true) => ({ month: m, netIncome, estimatedTax, afterTax: netIncome - estimatedTax, elapsed });

const summary = {
  netIncome: 6750,
  grossIncome: 7500,
  platformFees: 750,
  bookings: { confirmed: 1, completed: 3, cancelled: 1 },
  monthly: [{ month: '2026-09', transactions: 2, grossIncome: 2500, netIncome: 2250 }],
  topGigs: [{ gigId: 'g1', gigTitle: 'Modern logo and brand identity pack', netIncome: 2700 }],
};

const brackets = [
  { from: 0, to: 245100, rate: 0.18, incomeInBracket: 245100, taxInBracket: 44118, isCurrent: false },
  { from: 245100, to: 383100, rate: 0.26, incomeInBracket: 54900, taxInBracket: 14274, isCurrent: true },
  { from: 383100, to: 530200, rate: 0.31, incomeInBracket: 0, taxInBracket: 0, isCurrent: false },
  { from: 530200, to: 695800, rate: 0.36, incomeInBracket: 0, taxInBracket: 0, isCurrent: false },
];

const estimate = (overrides = {}) => ({
  taxYear: { label: '2026/27', start: '2026-03-01', end: '2027-02-28', monthsElapsed: 8 },
  ytdGross: 222222.22,
  ytdPlatformFees: 22222.22,
  ytdIncome: 200000,
  projectedAnnualIncome: 300000,
  estimatedAnnualTax: 40572,
  taxBeforeRebates: 58392,
  rebate: 17820,
  effectiveRate: 0.1352,
  marginalRate: 0.26,
  setAsideSoFar: 27048,
  takeHomeSoFar: 172952,
  taxThreshold: 99000,
  belowThreshold: false,
  brackets,
  months: [month('2026-03', 100000, 13520), month('2026-09', 100000, 13520), month('2027-02', 0, 0, false)],
  provisionalTax: [
    { period: 1, dueDate: '2026-08-31', amount: 20286 },
    { period: 2, dueDate: '2027-02-28', amount: 20286 },
  ],
  method: ['Taxable income is your net HustleHub+ earnings.'],
  disclaimer: 'Estimate for planning only.',
  ...overrides,
});

beforeEach(() => {
  api.incomeSummary.mockResolvedValue({ data: summary });
  api.taxEstimate.mockResolvedValue({ data: estimate() });
});

describe('EarningsPage tax dashboard', () => {
  test('shows the amount to set aside, the tax year and the key figures from the API', async () => {
    render(<EarningsPage />);

    const heroLabel = await screen.findByText('Set aside for SARS so far');
    expect(heroLabel.nextSibling).toHaveTextContent(/R\s?27\s?048/);
    expect(screen.getByRole('heading', { name: /Monthly income and tax \(2026\/27\)/ })).toBeInTheDocument();
    expect(screen.getByText('Effective tax rate').nextSibling).toHaveTextContent('13.5%');
    expect(screen.getByText('Marginal rate 26%')).toBeInTheDocument();
    expect(api.taxEstimate).toHaveBeenCalledWith('under65');
  });

  test('lists both provisional tax payments with due dates', async () => {
    render(<EarningsPage />);
    const schedule = (await screen.findByRole('heading', { name: 'Provisional tax payments' })).parentElement;
    expect(within(schedule).getByText('First payment')).toBeInTheDocument();
    expect(within(schedule).getByText(/Due 31 Aug 2026/)).toBeInTheDocument();
    expect(within(schedule).getByText(/Due 28 Feb 2027/)).toBeInTheDocument();
  });

  test('hovering a month column shows a tooltip with take-home and tax', async () => {
    render(<EarningsPage />);
    const column = await screen.findByLabelText(/September 2026: net income/);
    fireEvent.pointerEnter(column);

    const tooltip = screen.getByRole('status');
    expect(tooltip).toHaveTextContent('September 2026');
    expect(tooltip).toHaveTextContent(/86\s?480/); // take-home 100 000 - 13 520
    expect(tooltip).toHaveTextContent(/13\s?520/);

    fireEvent.pointerLeave(column);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  test('the chart can be shown as an accessible table', async () => {
    render(<EarningsPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Show as table' }));
    const table = screen.getByRole('columnheader', { name: 'Tax to set aside' }).closest('table');
    expect(within(table).getAllByRole('row')).toHaveLength(4); // header + 3 months
    expect(screen.getByRole('button', { name: 'Hide table' })).toHaveAttribute('aria-expanded', 'true');
  });

  test('changing the age group requests a new estimate with that group', async () => {
    render(<EarningsPage />);
    await userEvent.selectOptions(await screen.findByLabelText('Your age group'), '65to74');
    expect(api.taxEstimate).toHaveBeenLastCalledWith('65to74');
  });

  test('explains when income is below the tax threshold', async () => {
    api.taxEstimate.mockResolvedValue({ data: estimate({ belowThreshold: true, setAsideSoFar: 0, estimatedAnnualTax: 0 }) });
    render(<EarningsPage />);
    expect(await screen.findByText(/below the R\s?99\s?000,00 tax threshold/)).toBeInTheDocument();
  });

  test('shows a safe error message if the API refuses the request', async () => {
    api.taxEstimate.mockRejectedValue(new ApiError('You do not have permission to perform this action.', 403));
    render(<EarningsPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('You do not have permission');
  });
});

describe('TaxBracketBars', () => {
  test('shows brackets up to the current one plus the next, and marks the current bracket', () => {
    render(<TaxBracketBars brackets={brackets} />);
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(3); // 18%, 26% (current), 31% (next)
    expect(within(rows[1]).getByText('Your top bracket')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Not reached')).toBeInTheDocument();
  });
});
