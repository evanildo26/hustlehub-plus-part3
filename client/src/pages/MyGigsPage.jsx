import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import ConfirmButton from '../components/ConfirmButton';
import { Alert, EmptyState, Loader } from '../components/Feedback';
import { capitalise, formatCurrency, formatDate } from '../utils/format';

export default function MyGigsPage() {
  const [gigs, setGigs] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(() => {
    api
      .myGigs()
      .then((res) => setGigs(res.data))
      .catch((err) => setError(err.message));
  }, []);

  useEffect(load, [load]);

  const toggleActive = async (gig) => {
    setError('');
    try {
      const res = await api.updateGig(gig.id, { isActive: !gig.isActive });
      setGigs((list) => list.map((g) => (g.id === gig.id ? res.data : g)));
      setNotice(res.data.isActive ? `"${gig.title}" is now listed.` : `"${gig.title}" has been unlisted.`);
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (gig) => {
    setError('');
    try {
      await api.deleteGig(gig.id);
      setGigs((list) => list.filter((g) => g.id !== gig.id));
      setNotice(`"${gig.title}" was deleted.`);
    } catch (err) {
      setError(err.message); // e.g. 409 when the gig still has confirmed bookings.
    }
  };

  return (
    <section className="page">
      <div className="page__header">
        <div>
          <h1>My gigs</h1>
          <p className="muted">Create and manage the services you offer.</p>
        </div>
        <Link to="/my-gigs/new" className="btn btn--primary">
          + New gig
        </Link>
      </div>
      <Alert>{error}</Alert>
      <Alert type="success">{notice}</Alert>
      {!gigs ? (
        <Loader />
      ) : gigs.length === 0 ? (
        <EmptyState title="You haven't created any gigs yet">
          <Link to="/my-gigs/new" className="btn btn--primary">
            Create your first gig
          </Link>
        </EmptyState>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Gig</th>
                <th scope="col">Category</th>
                <th scope="col">Price</th>
                <th scope="col">Status</th>
                <th scope="col">Created</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {gigs.map((gig) => (
                <tr key={gig.id}>
                  <td>
                    <Link to={`/gigs/${gig.id}`}>{gig.title}</Link>
                  </td>
                  <td>{capitalise(gig.category)}</td>
                  <td>{formatCurrency(gig.price)}</td>
                  <td>
                    <span className={`badge ${gig.isActive ? 'badge--completed' : 'badge--cancelled'}`}>{gig.isActive ? 'Listed' : 'Unlisted'}</span>
                  </td>
                  <td>{formatDate(gig.createdAt)}</td>
                  <td className="actions">
                    <Link to={`/my-gigs/${gig.id}/edit`} className="btn btn--outline btn--sm">
                      Edit
                    </Link>
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => toggleActive(gig)}>
                      {gig.isActive ? 'Unlist' : 'List'}
                    </button>
                    <ConfirmButton onConfirm={() => remove(gig)} confirmLabel="Delete">
                      Delete
                    </ConfirmButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
