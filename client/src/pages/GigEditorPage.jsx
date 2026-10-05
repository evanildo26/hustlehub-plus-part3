import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import GigForm from '../components/GigForm';
import { Alert, Loader } from '../components/Feedback';

/** Create (/my-gigs/new) or edit (/my-gigs/:id/edit) a gig. */
export default function GigEditorPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [gig, setGig] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isEdit) return;
    api
      .getGig(id)
      .then((res) => {
        // The API would reject edits to someone else's gig anyway (403); this just avoids showing the form.
        if (res.data.freelancer?.id !== user.id) setError('You can only edit your own gigs.');
        else setGig(res.data);
      })
      .catch((err) => setError(err.message));
  }, [id, isEdit, user.id]);

  const handleSubmit = async (values) => {
    if (isEdit) await api.updateGig(id, values);
    else await api.createGig(values);
    navigate('/my-gigs');
  };

  if (error)
    return (
      <section className="page page--narrow">
        <Alert>{error}</Alert>
        <Link to="/my-gigs">← Back to my gigs</Link>
      </section>
    );
  if (isEdit && !gig) return <Loader label="Loading gig…" />;

  return (
    <section className="page page--narrow">
      <Link to="/my-gigs" className="back-link">
        ← Back to my gigs
      </Link>
      <h1>{isEdit ? 'Edit gig' : 'Create a new gig'}</h1>
      <GigForm
        initialValues={gig ? { ...gig, price: String(gig.price), deliveryDays: String(gig.deliveryDays) } : undefined}
        submitLabel={isEdit ? 'Save changes' : 'Publish gig'}
        onSubmit={handleSubmit}
      />
    </section>
  );
}
