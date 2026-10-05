import { useEffect, useState } from 'react';
import { api } from '../api/client';
import GigCard from '../components/GigCard';
import { Alert, EmptyState, Loader } from '../components/Feedback';
import { CATEGORIES } from '../utils/validation';
import { capitalise } from '../utils/format';
import { useAuth } from '../context/AuthContext';

const PAGE_SIZE = 12;

export default function GigsPage() {
  const { user } = useAuth();
  const [filters, setFilters] = useState({ search: '', category: '' });
  const [applied, setApplied] = useState({ search: '', category: '' });
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ gigs: [], pagination: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  const goToPage = (next) => {
    setLoading(true);
    setPage(next);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setLoading(true);
    setPage(1);
    setApplied({ search: filters.search.trim().slice(0, 50), category: filters.category });
  };

  const { gigs, pagination } = result;

  return (
    <section className="page">
      <div className="hero">
        <h1>Find the right freelancer for the job</h1>
        <p>
          {user?.role === 'client'
            ? 'Browse services from local freelancers and book in a few clicks.'
            : 'Design, development, writing and more - from talented South African freelancers.'}
        </p>
        <form className="search" role="search" onSubmit={handleSearch}>
          <label htmlFor="search" className="sr-only">
            Search gigs
          </label>
          <input
            id="search"
            type="search"
            placeholder="Search e.g. logo, website, blog…"
            maxLength={50}
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          />
          <label htmlFor="category" className="sr-only">
            Category
          </label>
          <select id="category" value={filters.category} onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}>
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {capitalise(c)}
              </option>
            ))}
          </select>
          <button type="submit" className="btn btn--primary">
            Search
          </button>
        </form>
      </div>

      <Alert>{error}</Alert>
      {loading ? (
        <Loader label="Loading gigs…" />
      ) : gigs.length === 0 ? (
        <EmptyState title="No gigs found">Try a different search term or category.</EmptyState>
      ) : (
        <>
          <p className="muted">
            {pagination.total} gig{pagination.total === 1 ? '' : 's'} available
          </p>
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
  );
}
