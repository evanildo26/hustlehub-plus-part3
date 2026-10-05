import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Alert, EmptyState, Loader } from '../components/Feedback';
import { formatCurrency, formatMonth } from '../utils/format';

/**
 * Freelancer income tracking. All figures are calculated server-side from
 * the freelancer's own transaction records (GET /api/income/summary).
 * Part 3 extends this page with tax estimation and charts.
 */
export default function EarningsPage() {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .incomeSummary()
      .then((res) => setSummary(res.data))
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <Alert>{error}</Alert>;
  if (!summary) return <Loader label="Calculating your earnings…" />;

  const tiles = [
    { label: 'Net income', value: formatCurrency(summary.netIncome), hint: 'What you keep after the 10% platform fee', primary: true },
    { label: 'Gross bookings', value: formatCurrency(summary.grossIncome), hint: 'Total paid by clients, net of refunds' },
    { label: 'Platform fees', value: formatCurrency(summary.platformFees), hint: '10% of each booking' },
    {
      label: 'Bookings',
      value: summary.bookings.confirmed + summary.bookings.completed + summary.bookings.cancelled,
      hint: `${summary.bookings.confirmed} in progress · ${summary.bookings.completed} completed · ${summary.bookings.cancelled} cancelled`,
    },
  ];

  return (
    <section className="page">
      <h1>Earnings</h1>
      <p className="muted">Income generated from your bookings.</p>

      <div className="stats">
        {tiles.map((t) => (
          <div key={t.label} className={`stat card${t.primary ? ' stat--primary' : ''}`}>
            <p className="stat__label">{t.label}</p>
            <p className="stat__value">{t.value}</p>
            <p className="stat__hint">{t.hint}</p>
          </div>
        ))}
      </div>

      {summary.monthly.length === 0 ? (
        <EmptyState title="No income yet">Your earnings will appear here once clients book your gigs.</EmptyState>
      ) : (
        <div className="two-col">
          <div className="card">
            <h2>Monthly breakdown</h2>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Month</th>
                    <th scope="col" className="num">
                      Transactions
                    </th>
                    <th scope="col" className="num">
                      Gross
                    </th>
                    <th scope="col" className="num">
                      Net income
                    </th>
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
    </section>
  );
}
