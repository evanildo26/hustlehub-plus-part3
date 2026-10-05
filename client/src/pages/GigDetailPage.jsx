import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CircleCheck, Clock, Lock, Pencil, Receipt, ShieldCheck } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import FormField from '../components/FormField';
import Avatar from '../components/Avatar';
import { Alert, Loader } from '../components/Feedback';
import { formatCurrency } from '../utils/format';
import { categoryMeta } from '../utils/categories';
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
        <span className="booking-panel__success" aria-hidden="true">
          <CircleCheck size={30} />
        </span>
        <h2>Booking confirmed 🎉</h2>
        <p className="muted">Your simulated payment was successful. The freelancer can now see your booking.</p>
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
      <div className="booking-panel__price">
        <span className="muted">Total price</span>
        <p className="price price--lg">{formatCurrency(gig.price)}</p>
      </div>
      <ul className="booking-panel__facts">
        <li>
          <Clock size={16} aria-hidden="true" /> Delivered in {gig.deliveryDays} day{gig.deliveryDays === 1 ? '' : 's'}
        </li>
        <li>
          <Receipt size={16} aria-hidden="true" /> Payment reference and receipt
        </li>
        <li>
          <ShieldCheck size={16} aria-hidden="true" /> Cancel any time before delivery
        </li>
      </ul>
      <Alert>{formError}</Alert>
      <FormField
        id="notes"
        as="textarea"
        rows={4}
        label="Notes for the freelancer (optional)"
        placeholder="Share any details that will help the freelancer get started."
        value={notes}
        onChange={(e) => {
          setNotes(e.target.value);
          setErrors({});
        }}
        error={errors.notes}
        maxLength={500}
        hint={`${notes.length}/500 characters`}
      />
      <button type="submit" className="btn btn--primary btn--block btn--lg" disabled={submitting}>
        {submitting ? 'Processing payment…' : `Book now - ${formatCurrency(gig.price)}`}
      </button>
      <p className="small muted center booking-panel__note">
        <Lock size={13} aria-hidden="true" /> Payments are simulated. No real money is charged.
      </p>
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
  const meta = categoryMeta(gig.category);
  const Icon = meta.icon;
  const freelancerName = gig.freelancer?.name || 'Freelancer';

  return (
    <section className="page">
      <Link to="/" className="back-link">
        <ArrowLeft size={16} aria-hidden="true" /> Back to the marketplace
      </Link>
      <div className="detail">
        <div className="detail__main">
          <div className={`detail__cover cover--${gig.category}`}>
            <Icon size={56} strokeWidth={1.4} aria-hidden="true" />
          </div>
          <div className="card detail__body">
            <div className="detail__tags">
              <span className={`tag tag--${gig.category}`}>{meta.label}</span>
              {!gig.isActive && <span className="badge badge--cancelled">Not listed</span>}
            </div>
            <h1>{gig.title}</h1>
            <div className="seller">
              <Avatar name={freelancerName} size="lg" />
              <div>
                <p className="seller__name">{freelancerName}</p>
                <p className="muted small">{meta.label} freelancer on HustleHub+</p>
              </div>
            </div>
            <h2 className="detail__subheading">About this gig</h2>
            <p className="detail__description">{gig.description}</p>
            <div className="detail__facts">
              <div>
                <Clock size={18} aria-hidden="true" />
                <span>
                  <strong>{gig.deliveryDays} days</strong>
                  <span className="muted small">Delivery time</span>
                </span>
              </div>
              <div>
                <Receipt size={18} aria-hidden="true" />
                <span>
                  <strong>{formatCurrency(gig.price)}</strong>
                  <span className="muted small">Fixed price</span>
                </span>
              </div>
              <div>
                <ShieldCheck size={18} aria-hidden="true" />
                <span>
                  <strong>Recorded</strong>
                  <span className="muted small">Every booking gets a transaction</span>
                </span>
              </div>
            </div>
          </div>
        </div>
        <aside className="detail__side">
          {user?.role === 'client' && <BookingPanel gig={gig} />}
          {isOwner && (
            <div className="card side-card">
              <p className="side-card__title">This is your gig</p>
              <p className="muted small">Clients see it exactly like this.</p>
              <Link to={`/my-gigs/${gig.id}/edit`} className="btn btn--primary btn--block">
                <Pencil size={16} aria-hidden="true" /> Edit gig
              </Link>
            </div>
          )}
          {!user && (
            <div className="card side-card">
              <p className="price price--lg">{formatCurrency(gig.price)}</p>
              <p className="muted">Log in with a client account to book this gig.</p>
              <Link to="/login" state={{ from: `/gigs/${gig.id}` }} className="btn btn--primary btn--block">
                Log in to book
              </Link>
              <Link to="/register" className="btn btn--ghost btn--block">
                Create a free account
              </Link>
            </div>
          )}
          {user && user.role !== 'client' && !isOwner && (
            <div className="card side-card">
              <p className="price price--lg">{formatCurrency(gig.price)}</p>
              <p className="muted small">Only client accounts can book gigs.</p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
