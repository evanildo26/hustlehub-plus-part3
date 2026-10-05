import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader } from './Feedback';

/**
 * Guards a page by login state and (optionally) role.
 *
 * This is a usability feature, not the security boundary - hiding a page
 * in the browser doesn't stop someone calling the API directly. The real
 * enforcement is the API's JWT + restrictTo checks; this just avoids
 * showing users pages they can't use.
 */
export default function ProtectedRoute({ roles, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Loader label="Checking your session…" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  if (roles && !roles.includes(user.role)) {
    return (
      <section className="page page--narrow">
        <h1>Access denied</h1>
        <p className="muted">This page is only available to {roles.join(' / ')} accounts.</p>
        <Link className="btn btn--primary" to="/">
          Back to the marketplace
        </Link>
      </section>
    );
  }
  return children;
}
