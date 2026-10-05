import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import FormField from '../components/FormField';
import { Alert, Loader } from '../components/Feedback';
import { capitalise, formatCurrency } from '../utils/format';
import { hasErrors, validateBookingNotes } from '../utils/validation';

/** Booking panel shown to clients. Payment is simulated, as the brief allows. */
function BookingPanel({ gig }) {
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    const clientErrors = validateBookingNotes(notes);
    if (hasErrors(clientErrors)) {
      setErrors(clientErrors);
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.createBooking(gig.id, notes.trim());
      setConfirmation(res.data);
    } catch (err) {
      setErrors(err.fieldMap || {});
      setFormError(err.message); // Includes the API's clear 429 message if the booking rate limit is hit.
    } finally {
      setSubmitting(false);
    }
  };

  if (confirmation) {
    const { booking, transaction } = confirmation;
    return (
      <div className="card booking-panel booking-panel--done" role="status">
        <h2>Booking confirmed 🎉</h2>
        <p>Your simulated payment was successful.</p>
        <dl className="details">
          <dt>Amount paid</dt>
          <dd>{formatCurrency(booking.amount)}</dd>
          <dt>Payment reference</dt>
          <dd>
            <code>{booking.paymentReference}</code>
          </dd>
          <dt>Transaction</dt>
          <dd>
            <code>{transaction.reference}</code>
          </dd>
        </dl>
        <Link to="/bookings" className="btn btn--primary btn--block">
          View my bookings
        </Link>
      </div>
    );
  }

  return (
    <form className="card booking-panel" onSubmit={handleSubmit} noValidate>
      <p className="price price--lg">{formatCurrency(gig.price)}</p>
      <p className="muted">Delivered in {gig.deliveryDays} day{gig.deliveryDays === 1 ? '' : 's'}</p>
      <Alert>{formError}</Alert>
      <FormField
        id="notes"
        as="textarea"
        rows={4}
        label="Notes for the freelancer (optional)"
        value={notes}
        onChange={(e) => {
          setNotes(e.target.value);
          setErrors({});
        }}
        error={errors.notes}
        maxLength={500}
        hint={`${notes.length}/500 characters`}
      />
      <button type="submit" className="btn btn--primary btn--block" disabled={submitting}>
        {submitting ? 'Processing payment…' : `Book now - ${formatCurrency(gig.price)}`}
      </button>
      <p className="small muted center">Payments are simulated. No real money is charged.</p>
    </form>
  );
}

export default function GigDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [gig, setGig] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .getGig(id)
      .then((res) => setGig(res.data))
      .catch((err) => setError(err.status === 400 || err.status === 404 ? 'This gig could not be found.' : err.message));
  }, [id]);

  if (error)
    return (
      <section className="page page--narrow">
        <Alert>{error}</Alert>
        <Link to="/">← Back to the marketplace</Link>
      </section>
    );
  if (!gig) return <Loader label="Loading gig…" />;

  const isOwner = user && gig.freelancer?.id === user.id;

  return (
    <section className="page">
      <Link to="/" className="back-link">
        ← Back to the marketplace
      </Link>
      <div className="detail">
        <div className="detail__main card">
          <span className={`chip chip--${gig.category}`}>{capitalise(gig.category)}</span>
          {!gig.isActive && <span className="badge badge--cancelled">Not listed</span>}
          <h1>{gig.title}</h1>
          <p className="muted">Offered by {gig.freelancer?.name}</p>
          <p className="detail__description">{gig.description}</p>
        </div>
        <aside className="detail__side">
          {user?.role === 'client' && <BookingPanel gig={gig} />}
          {isOwner && (
            <div className="card">
              <p>This is your gig.</p>
              <Link to={`/my-gigs/${gig.id}/edit`} className="btn btn--primary btn--block">
                Edit gig
              </Link>
            </div>
          )}
          {!user && (
            <div className="card">
              <p className="price price--lg">{formatCurrency(gig.price)}</p>
              <p>Log in with a client account to book this gig.</p>
              <Link to="/login" state={{ from: `/gigs/${gig.id}` }} className="btn btn--primary btn--block">
                Log in to book
              </Link>
            </div>
          )}
          {user && user.role !== 'client' && !isOwner && (
            <div className="card">
              <p className="price price--lg">{formatCurrency(gig.price)}</p>
              <p className="muted">Only client accounts can book gigs.</p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
