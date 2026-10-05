import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import FormField from '../components/FormField';
import { Alert } from '../components/Feedback';
import { hasErrors, validateLogin } from '../utils/validation';

const HOME_BY_ROLE = { client: '/', freelancer: '/my-gigs', admin: '/admin' };

export default function LoginPage() {
  const { user, login, sessionExpired } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [values, setValues] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to={HOME_BY_ROLE[user.role] || '/'} replace />;

  const update = (field) => (e) => {
    setValues((v) => ({ ...v, [field]: e.target.value }));
    setErrors((errs) => ({ ...errs, [field]: undefined }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    const clientErrors = validateLogin(values);
    if (hasErrors(clientErrors)) {
      setErrors(clientErrors);
      return;
    }
    setSubmitting(true);
    try {
      const loggedIn = await login(values.email.trim(), values.password);
      navigate(location.state?.from || HOME_BY_ROLE[loggedIn.role] || '/', { replace: true });
    } catch (err) {
      setErrors(err.fieldMap || {});
      setFormError(err.message); // e.g. the API's generic "Invalid email or password." or a rate-limit message.
      setValues((v) => ({ ...v, password: '' }));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="page page--narrow">
      <h1>Log in</h1>
      <p className="muted">Welcome back to HustleHub+.</p>
      {sessionExpired && <Alert type="info">Your session has expired. Please log in again.</Alert>}
      {location.state?.registered && <Alert type="success">Account created successfully. You can now log in.</Alert>}
      <form className="form card" onSubmit={handleSubmit} noValidate>
        <Alert>{formError}</Alert>
        <FormField id="email" type="email" label="Email" autoComplete="email" value={values.email} onChange={update('email')} error={errors.email} />
        <FormField
          id="password"
          type="password"
          label="Password"
          autoComplete="current-password"
          value={values.password}
          onChange={update('password')}
          error={errors.password}
        />
        <button type="submit" className="btn btn--primary btn--block" disabled={submitting}>
          {submitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>
      <p className="muted center">
        New to HustleHub+? <Link to="/register">Create an account</Link>
      </p>
    </section>
  );
}
