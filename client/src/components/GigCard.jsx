import { Link } from 'react-router-dom';
import { ArrowRight, Clock } from 'lucide-react';
import { formatCurrency } from '../utils/format';
import { categoryMeta } from '../utils/categories';
import Avatar from './Avatar';

/**
 * Marketplace card for one gig. All values are rendered as text by React,
 * which escapes them - there is no dangerouslySetInnerHTML anywhere in the
 * app, so stored content can never be interpreted as HTML.
 */
export default function GigCard({ gig }) {
  const meta = categoryMeta(gig.category);
  const Icon = meta.icon;
  const excerpt = gig.description.length > 110 ? `${gig.description.slice(0, 110).trimEnd()}…` : gig.description;
  const freelancerName = gig.freelancer?.name || 'Freelancer';

  return (
    <article className="gig-card">
      <div className={`gig-card__cover cover--${gig.category}`}>
        <Icon className="gig-card__icon" size={34} strokeWidth={1.6} aria-hidden="true" />
        <span className="gig-card__chip">{meta.label}</span>
      </div>
      <div className="gig-card__body">
        <div className="gig-card__seller">
          <Avatar name={freelancerName} size="sm" />
          <span>by {freelancerName}</span>
        </div>
        <h3 className="gig-card__title">
          <Link to={`/gigs/${gig.id}`} className="stretched-link">
            {gig.title}
          </Link>
        </h3>
        <p className="gig-card__desc">{excerpt}</p>
      </div>
      <div className="gig-card__footer">
        <span className="gig-card__delivery">
          <Clock size={15} aria-hidden="true" />
          {gig.deliveryDays} day{gig.deliveryDays === 1 ? '' : 's'}
        </span>
        <span className="gig-card__price">
          <span className="gig-card__price-label">Price</span>
          {formatCurrency(gig.price)}
        </span>
        <Link to={`/gigs/${gig.id}`} className="gig-card__cta" aria-label={`View ${gig.title}`}>
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
