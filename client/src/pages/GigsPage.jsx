import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarCheck, LayoutGrid, Lock, Search, ShieldCheck, UserPlus, Wallet } from 'lucide-react';
import { api } from '../api/client';
import GigCard from '../components/GigCard';
import { Alert, EmptyState, Loader } from '../components/Feedback';
import { CATEGORIES } from '../utils/validation';
import { CATEGORY_META } from '../utils/categories';
import { useAuth } from '../context/AuthContext';

const PAGE_SIZE = 12;
const POPULAR_SEARCHES = ['Logo', 'Website', 'CV', 'Video editing', 'Voice-over'];

const STEPS = [
  { icon: Search, title: 'Find the right service', text: 'Search by keyword or category and compare prices and delivery times.' },
  { icon: CalendarCheck, title: 'Book in a few clicks', text: 'Add a note for the freelancer and confirm. Every booking gets a payment reference.' },
  { icon: Wallet, title: 'Freelancers get paid', text: 'Each booking is recorded as a transaction, and freelancers track their income on a dashboard.' },
];

export default function GigsPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [applied, setApplied] = useState({ search: '', category: '' });
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ gigs: [], pagination: null });
  const [categories, setCategories] = useState({ list: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .categories()
      .then((res) => setCategories({ list: res.data, total: res.total }))
      .catch(() => {}); // Counts are a nice-to-have; the page works without them.
  }, []);

  useEffect(() => {
    let cancelled = false; // Ignore responses that arrive after the filters have changed again.
    api
      .listGigs({ ...applied, page, limit: PAGE_SIZE })
      .then((res) => {
        if (cancelled) return;
        setError('');
        setResult({ gigs: res.data, pagination: res.pagination });
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [applied, page]);

  const apply = (next) => {
    setLoading(true);
    setPage(1);
    setApplied((prev) => ({ ...prev, ...next }));
  };

  const goToPage = (next) => {
    setLoading(true);
    setPage(next);
    window.scrollTo?.({ top: 0, behavior: 'smooth' });
  };

  const handleSearch = (e) => {
    e.preventDefault();
    apply({ search: search.trim().slice(0, 50) });
  };

  const countFor = (category) => categories.list.find((c) => c.category === category)?.count;
  const { gigs, pagination } = result;
  const activeLabel = applied.category ? CATEGORY_META[applied.category].label : 'All services';

  return (
    <div className="home">
      <section className="hero">
        <div className="hero__content">
          <span className="hero__eyebrow">
            <ShieldCheck size={16} aria-hidden="true" /> Secure freelance marketplace
          </span>
          <h1>
            Find the right freelancer
            <br />
            <span className="hero__highlight">for the job.</span>
          </h1>
          <p className="hero__lead">
            {user?.role === 'freelancer'
              ? 'See what other freelancers are offering, then list your own services and start earning.'
              : 'Browse services from talented South African freelancers and book in a few clicks - design, development, writing and more.'}
          </p>
          <form className="search" role="search" onSubmit={handleSearch}>
            <Search className="search__icon" size={20} aria-hidden="true" />
            <label htmlFor="search" className="sr-only">
              Search gigs
            </label>
            <input id="search" type="search" placeholder="What do you need help with?" maxLength={50} value={search} onChange={(e) => setSearch(e.target.value)} />
            <label htmlFor="category" className="sr-only">
              Category
            </label>
            <select id="category" value={applied.category} onChange={(e) => apply({ category: e.target.value })}>
              <option value="">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_META[c].label}
                </option>
              ))}
            </select>
            <button type="submit" className="btn btn--accent">
              Search
            </button>
          </form>
          <div className="hero__popular">
            <span>Popular:</span>
            {POPULAR_SEARCHES.map((term) => (
              <button
                key={term}
                type="button"
                className="pill"
                onClick={() => {
                  setSearch(term);
                  apply({ search: term });
                }}
              >
                {term}
              </button>
            ))}
          </div>
        </div>
        <ul className="hero__stats" aria-label="Marketplace at a glance">
          <li>
            <strong>{categories.total || '20+'}</strong>
            <span>services listed</span>
          </li>
          <li>
            <strong>8</strong>
            <span>categories</span>
          </li>
          <li>
            <Lock size={22} aria-hidden="true" />
            <span>HTTPS encrypted</span>
          </li>
        </ul>
      </section>

      <section aria-labelledby="categories-heading" className="section">
        <h2 id="categories-heading" className="section__title">
          Explore categories
        </h2>
        <div className="categories">
          <button type="button" className={`category${applied.category === '' ? ' category--active' : ''}`} onClick={() => apply({ category: '' })} aria-pressed={applied.category === ''}>
            <span className="category__icon cover--all">
              <LayoutGrid size={20} aria-hidden="true" />
            </span>
            <span className="category__text">
              <strong>All services</strong>
              <span>{categories.total ? `${categories.total} gigs` : 'Everything'}</span>
            </span>
          </button>
          {CATEGORIES.map((c) => {
            const { label, icon: Icon, blurb } = CATEGORY_META[c];
            const count = countFor(c);
            return (
              <button key={c} type="button" className={`category${applied.category === c ? ' category--active' : ''}`} onClick={() => apply({ category: c })} aria-pressed={applied.category === c}>
                <span className={`category__icon cover--${c}`}>
                  <Icon size={20} aria-hidden="true" />
                </span>
                <span className="category__text">
                  <strong>{label}</strong>
                  <span>{count !== undefined ? `${count} gig${count === 1 ? '' : 's'}` : blurb}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="results-heading" className="section">
        <div className="section__header">
          <div>
            <h2 id="results-heading" className="section__title">
              {applied.search ? `Results for "${applied.search}"` : activeLabel}
            </h2>
            {!loading && pagination && (
              <p className="muted">
                {pagination.total} gig{pagination.total === 1 ? '' : 's'} available
              </p>
            )}
          </div>
          {(applied.search || applied.category) && (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => {
                setSearch('');
                apply({ search: '', category: '' });
              }}
            >
              Clear filters
            </button>
          )}
        </div>

        <Alert>{error}</Alert>
        {loading ? (
          <Loader label="Loading gigs…" />
        ) : gigs.length === 0 ? (
          <EmptyState title="No gigs found">Try a different search term or category.</EmptyState>
        ) : (
          <>
            <div className="grid">
              {gigs.map((gig) => (
                <GigCard key={gig.id} gig={gig} />
              ))}
            </div>
            {pagination.pages > 1 && (
              <nav className="pagination" aria-label="Pagination">
                <button type="button" className="btn btn--ghost btn--sm" disabled={page <= 1} onClick={() => goToPage(page - 1)}>
                  Previous
                </button>
                <span>
                  Page {page} of {pagination.pages}
                </span>
                <button type="button" className="btn btn--ghost btn--sm" disabled={page >= pagination.pages} onClick={() => goToPage(page + 1)}>
                  Next
                </button>
              </nav>
            )}
          </>
        )}
      </section>

      {!user && (
        <>
          <section aria-labelledby="how-heading" className="section how">
            <h2 id="how-heading" className="section__title center">
              How HustleHub+ works
            </h2>
            <ol className="steps">
              {STEPS.map(({ icon: Icon, title, text }, i) => (
                <li key={title} className="step">
                  <span className="step__icon">
                    <Icon size={22} aria-hidden="true" />
                  </span>
                  <span className="step__number">Step {i + 1}</span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </li>
              ))}
            </ol>
          </section>
          <section className="cta">
            <div>
              <h2>Ready to turn your skills into income?</h2>
              <p>Create a free freelancer account, list your services and track every rand you earn.</p>
            </div>
            <Link to="/register" className="btn btn--accent btn--lg">
              <UserPlus size={18} aria-hidden="true" />
              Start selling
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </section>
        </>
      )}
    </div>
  );
}
