import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Alert, EmptyState, Loader } from '../components/Feedback';
import { capitalise, formatCurrency, formatDate } from '../utils/format';

/** Read-only financial history. Clients see payments; freelancers also see the fee split. */
export default function TransactionsPage() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .listTransactions()
      .then((res) => setTransactions(res.data))
      .catch((err) => setError(err.message));
  }, []);

  const showSplit = user.role !== 'client';

  return (
    <section className="page">
      <h1>{user.role === 'client' ? 'Payments' : user.role === 'admin' ? 'All transactions' : 'Transactions'}</h1>
      <p className="muted">Every booking creates a payment record; cancellations add a refund. Records can never be edited.</p>
      <Alert>{error}</Alert>
      {!transactions ? (
        <Loader />
      ) : transactions.length === 0 ? (
        <EmptyState title="No transactions yet" />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Reference</th>
                <th scope="col">Gig</th>
                {user.role === 'admin' && <th scope="col">Client → Freelancer</th>}
                <th scope="col">Type</th>
                <th scope="col" className="num">
                  Amount
                </th>
                {showSplit && (
                  <th scope="col" className="num">
                    Platform fee
                  </th>
                )}
                {showSplit && (
                  <th scope="col" className="num">
                    Freelancer earnings
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id}>
                  <td>{formatDate(t.createdAt)}</td>
                  <td>
                    <code>{t.reference}</code>
                  </td>
                  <td>{t.gigTitle}</td>
                  {user.role === 'admin' && (
                    <td>
                      {t.client?.name} → {t.freelancer?.name}
                    </td>
                  )}
                  <td>
                    <span className={`badge badge--${t.type}`}>{capitalise(t.type)}</span>
                  </td>
                  <td className={`num${t.amount < 0 ? ' negative' : ''}`}>{formatCurrency(t.amount)}</td>
                  {showSplit && <td className="num">{formatCurrency(t.platformFee)}</td>}
                  {showSplit && <td className={`num${t.freelancerEarnings < 0 ? ' negative' : ''}`}>{formatCurrency(t.freelancerEarnings)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
