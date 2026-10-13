import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { CalendarCheck, Landmark, Percent, TrendingUp, Wallet } from 'lucide-react';
import { Alert, EmptyState, Loader } from '../components/Feedback';
import StatCard from '../components/StatCard';
import MonthlyTaxChart from '../components/charts/MonthlyTaxChart';
import IncomeSplitBar from '../components/charts/IncomeSplitBar';
import TaxBracketBars from '../components/charts/TaxBracketBars';
import { formatCurrency, formatDate, formatMonth, formatPercent } from '../utils/format';

const AGE_GROUPS = [
  { value: 'under65', label: 'Under 65' },
  { value: '65to74', label: '65 to 74' },
  { value: '75plus', label: '75 and older' },
];

/**
 * Freelancer income and tax dashboard. Every figure is calculated
 * server-side from the freelancer's own transactions:
 *   GET /api/income/summary       all-time income, bookings, monthly totals, top gigs
 *   GET /api/income/tax-estimate  SARS tax estimate for the current tax year
 * The page only formats and draws what the API returns.
 */
export default function EarningsPage() {
  const [summary, setSummary] = useState(null);
  const [tax, setTax] = useState(null);
  const [ageGroup, setAgeGroup] = useState('under65');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .incomeSummary()
      .then((res) => setSummary(res.data))
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    api
      .taxEstimate(ageGroup)
      .then((res) => setTax(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setRefreshing(false));
  }, [ageGroup]);

  if (error) return <Alert>{error}</Alert>;
  if (!summary || !tax) return <Loader label="Calculating your earnings…" />;

  const tiles = [
    { icon: Wallet, label: 'Net income (all time)', value: formatCurrency(summary.netIncome), hint: 'What you keep after the 10% platform fee', tone: 'primary' },
    { icon: TrendingUp, label: 'Projected annual income', value: formatCurrency(tax.projectedAnnualIncome), hint: `Based on ${tax.taxYear.monthsElapsed} month${tax.taxYear.monthsElapsed === 1 ? '' : 's'} of ${tax.taxYear.label}` },
    { icon: Landmark, label: 'Estimated annual tax', value: formatCurrency(tax.estimatedAnnualTax), hint: `After the ${formatCurrency(tax.rebate)} SARS rebate` },
    { icon: Percent, label: 'Effective tax rate', value: formatPercent(tax.effectiveRate), hint: `Marginal rate ${formatPercent(tax.marginalRate, 0)}` },
    {
      icon: CalendarCheck,
      label: 'Bookings',
      value: summary.bookings.confirmed + summary.bookings.completed + summary.bookings.cancelled,
      hint: `${summary.bookings.confirmed} in progress · ${summary.bookings.completed} completed · ${summary.bookings.cancelled} cancelled`,
    },
  ];

  return (
    <section className="page earnings">
      <div className="page__header">
        <div>
          <h1>Earnings &amp; tax</h1>
          <p className="muted">
            Income from your bookings and an estimate of the tax on it for the {tax.taxYear.label} tax year ({formatDate(tax.taxYear.start)} – {formatDate(tax.taxYear.end)}).
          </p>
        </div>
        <div className="field field--inline">
          <label htmlFor="age-group">Your age group</label>
          <select id="age-group" value={ageGroup} onChange={(e) => {
              setRefreshing(true); // Dim the current figures while the new estimate loads (no layout jump).
              setAgeGroup(e.target.value);
            }}>
            {AGE_GROUPS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={`earnings__body${refreshing ? ' is-refreshing' : ''}`}>
        <div className="card tax-hero">
          <p className="tax-hero__label">Set aside for SARS so far</p>
          <p className="tax-hero__value">{formatCurrency(tax.setAsideSoFar)}</p>
          <p className="muted">
            of the {formatCurrency(tax.ytdIncome)} you have earned this tax year.{' '}
            {tax.belowThreshold
              ? `Your projected income is below the ${formatCurrency(tax.taxThreshold)} tax threshold, so no income tax is expected.`
              : `Keeping ${formatPercent(tax.effectiveRate)} of each payment aside covers your estimated tax.`}
          </p>
        </div>

        <div className="stats">
          {tiles.map((t) => (
            <StatCard key={t.label} {...t} />
          ))}
        </div>

        <div className="card">
          <h2>Monthly income and tax ({tax.taxYear.label})</h2>
          <p className="muted small">Each column is that month&apos;s net income: the part you keep, with the estimated tax to set aside on top.</p>
          <MonthlyTaxChart months={tax.months} />
        </div>

        <div className="two-col two-col--even">
          <div className="card">
            <h2>Where client payments go</h2>
            <IncomeSplitBar gross={tax.ytdGross} platformFees={tax.ytdPlatformFees} tax={tax.setAsideSoFar} takeHome={tax.takeHomeSoFar} />
          </div>
          <div className="card">
            <h2>Provisional tax payments</h2>
            <p className="muted small">Freelancers pay income tax in advance to SARS in two instalments (IRP6).</p>
            <ul className="schedule">
              {tax.provisionalTax.map((p) => (
                <li key={p.period}>
                  <span>
                    <strong>{p.period === 1 ? 'First payment' : 'Second payment'}</strong>
                    <span className="muted small">Due {formatDate(p.dueDate)}</span>
                  </span>
                  <strong>{formatCurrency(p.amount)}</strong>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="card">
          <h2>How your tax is calculated</h2>
          <div className="two-col two-col--even">
            <div>
              <TaxBracketBars brackets={tax.brackets} />
              <p className="muted small">
                Tax before rebate {formatCurrency(tax.taxBeforeRebates)} − rebate {formatCurrency(tax.rebate)} ={' '}
                <strong>{formatCurrency(tax.estimatedAnnualTax)}</strong> on a projected {formatCurrency(tax.projectedAnnualIncome)}.
              </p>
            </div>
            <div>
              <ol className="method">
                {tax.method.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              <p className="alert alert--info small">{tax.disclaimer}</p>
            </div>
          </div>
        </div>

        {summary.monthly.length === 0 ? (
          <EmptyState title="No income yet">Your earnings will appear here once clients book your gigs.</EmptyState>
        ) : (
          <div className="two-col">
            <div className="card">
              <h2>All-time monthly breakdown</h2>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">Month</th>
                      <th scope="col" className="num">Transactions</th>
                      <th scope="col" className="num">Gross</th>
                      <th scope="col" className="num">Net income</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.monthly.map((m) => (
                      <tr key={m.month}>
                        <td>{formatMonth(m.month)}</td>
                        <td className="num">{m.transactions}</td>
                        <td className="num">{formatCurrency(m.grossIncome)}</td>
                        <td className="num">{formatCurrency(m.netIncome)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="card">
              <h2>Top gigs</h2>
              <ol className="top-list">
                {summary.topGigs.map((g) => (
                  <li key={g.gigId}>
                    <span>{g.gigTitle}</span>
                    <strong>{formatCurrency(g.netIncome)}</strong>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
