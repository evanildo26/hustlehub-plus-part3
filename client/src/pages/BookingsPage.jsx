import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import ConfirmButton from '../components/ConfirmButton';
import { Alert, EmptyState, Loader, StatusBadge } from '../components/Feedback';
import { formatCurrency, formatDate } from '../utils/format';

const TITLES = {
  client: ['My bookings', 'Services you have booked.'],
  freelancer: ['Bookings', 'Clients who have booked your gigs.'],
  admin: ['All bookings', 'Every booking on the platform (read-only).'],
};

export default function BookingsPage() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    api
      .listBookings()
      .then((res) => setBookings(res.data))
      .catch((err) => setError(err.message));
  }, []);

  const runAction = async (action, booking) => {
    setError('');
    setNotice('');
    try {
      const res = action === 'complete' ? await api.completeBooking(booking.id) : await api.cancelBooking(booking.id);
      const updated = res.data.booking || res.data;
      setBookings((list) => list.map((b) => (b.id === booking.id ? { ...b, ...updated } : b)));
      setNotice(res.message);
    } catch (err) {
      setError(err.message);
    }
  };

  const [title, subtitle] = TITLES[user.role];
  const showClient = user.role !== 'client';
  const showFreelancer = user.role !== 'freelancer';

  return (
    <section className="page">
      <h1>{title}</h1>
      <p className="muted">{subtitle}</p>
      <Alert>{error}</Alert>
      <Alert type="success">{notice}</Alert>
      {!bookings ? (
        <Loader />
      ) : bookings.length === 0 ? (
        <EmptyState title="No bookings yet">
          {user.role === 'client' ? (
            <Link to="/" className="btn btn--primary">
              Browse gigs
            </Link>
          ) : (
            'Bookings will appear here as soon as clients book your gigs.'
          )}
        </EmptyState>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Gig</th>
                {showClient && <th scope="col">Client</th>}
                {showFreelancer && <th scope="col">Freelancer</th>}
                <th scope="col">Amount</th>
                <th scope="col">Booked</th>
                <th scope="col">Status</th>
                <th scope="col">Notes</th>
                {user.role !== 'admin' && (
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id}>
                  <td>
                    {b.gigTitle}
                    <div className="small muted">
                      <code>{b.paymentReference}</code>
                    </div>
                  </td>
                  {showClient && <td>{b.client?.name}</td>}
                  {showFreelancer && <td>{b.freelancer?.name}</td>}
                  <td>{formatCurrency(b.amount)}</td>
                  <td>{formatDate(b.createdAt)}</td>
                  <td>
                    <StatusBadge status={b.status} />
                  </td>
                  <td className="notes">{b.notes || <span className="muted">-</span>}</td>
                  {user.role !== 'admin' && (
                    <td className="actions">
                      {b.status === 'confirmed' && user.role === 'freelancer' && (
                        <button type="button" className="btn btn--primary btn--sm" onClick={() => runAction('complete', b)}>
                          Mark completed
                        </button>
                      )}
                      {b.status === 'confirmed' && (
                        <ConfirmButton onConfirm={() => runAction('cancel', b)} confirmLabel="Cancel booking">
                          Cancel
                        </ConfirmButton>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
