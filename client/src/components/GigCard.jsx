import { Link } from 'react-router-dom';
import { capitalise, formatCurrency } from '../utils/format';

/**
 * Marketplace card for one gig. All values are rendered as text by React,
 * which escapes them - there is no dangerouslySetInnerHTML anywhere in the
 * app, so stored content can never be interpreted as HTML.
 */
export default function GigCard({ gig }) {
  const excerpt = gig.description.length > 140 ? `${gig.description.slice(0, 140).trimEnd()}…` : gig.description;

  return (
    <article className="card gig-card">
      <span className={`chip chip--${gig.category}`}>{capitalise(gig.category)}</span>
      <h3 className="gig-card__title">
        <Link to={`/gigs/${gig.id}`}>{gig.title}</Link>
      </h3>
      <p className="gig-card__desc">{excerpt}</p>
      <div className="gig-card__meta">
        <span className="muted">by {gig.freelancer?.name || 'Freelancer'}</span>
        <span className="muted">
          {gig.deliveryDays} day{gig.deliveryDays === 1 ? '' : 's'}
        </span>
      </div>
      <div className="gig-card__footer">
        <span className="price">{formatCurrency(gig.price)}</span>
        <Link to={`/gigs/${gig.id}`} className="btn btn--outline btn--sm" aria-label={`View ${gig.title}`}>
          View
        </Link>
      </div>
    </article>
  );
}
