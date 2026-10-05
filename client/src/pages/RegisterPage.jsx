import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import FormField from '../components/FormField';
import { Alert } from '../components/Feedback';
import AuthLayout from '../components/AuthLayout';
import { PASSWORD_RULES, hasErrors, validateRegister } from '../utils/validation';

export default function RegisterPage() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [values, setValues] = useState({ name: '', email: '', password: '', confirmPassword: '', role: 'client' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const update = (field) => (e) => {
    setValues((v) => ({ ...v, [field]: e.target.value }));
    setErrors((errs) => ({ ...errs, [field]: undefined }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    const clientErrors = validateRegister(values);
    if (hasErrors(clientErrors)) {
      setErrors(clientErrors);
      return;
    }
    setSubmitting(true);
    try {
      const { name, email, password, role } = values; // confirmPassword is never sent to the API.
      await register({ name: name.trim(), email: email.trim(), password, role });
      navigate('/login', { replace: true, state: { registered: true } });
    } catch (err) {
      setErrors(err.fieldMap || {});
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Book talented freelancers, or start selling your own services."
      footer={
        <>
          Already have an account? <Link to="/login">Log in</Link>
        </>
      }
    >
      <form className="form" onSubmit={handleSubmit} noValidate>
        <Alert>{formError}</Alert>

        <fieldset className="role-picker">
          <legend>I want to…</legend>
          {[
            { value: 'client', title: 'Hire freelancers', text: 'Browse and book gigs' },
            { value: 'freelancer', title: 'Offer my services', text: 'List gigs and earn' },
          ].map((opt) => (
            <label key={opt.value} className={`role-option${values.role === opt.value ? ' role-option--active' : ''}`}>
              <input type="radio" name="role" value={opt.value} checked={values.role === opt.value} onChange={update('role')} />
              <strong>{opt.title}</strong>
              <span className="muted">{opt.text}</span>
            </label>
          ))}
        </fieldset>
        {errors.role && <p className="field__error">{errors.role}</p>}

        <FormField id="name" label="Full name" autoComplete="name" value={values.name} onChange={update('name')} error={errors.name} maxLength={100} />
        <FormField id="email" type="email" label="Email" autoComplete="email" value={values.email} onChange={update('email')} error={errors.email} />
        <FormField
          id="password"
          type="password"
          label="Password"
          autoComplete="new-password"
          value={values.password}
          onChange={update('password')}
          error={errors.password}
          maxLength={128}
        />
        <ul className="password-rules" aria-label="Password requirements">
          {PASSWORD_RULES.map((rule) => {
            const ok = rule.test(values.password);
            return (
              <li key={rule.id} className={ok ? 'ok' : ''}>
                <span aria-hidden="true">{ok ? '✓' : '•'}</span> {rule.label}
                <span className="sr-only">{ok ? ' (met)' : ' (not met)'}</span>
              </li>
            );
          })}
        </ul>
        <FormField
          id="confirmPassword"
          type="password"
          label="Confirm password"
          autoComplete="new-password"
          value={values.confirmPassword}
          onChange={update('confirmPassword')}
          error={errors.confirmPassword}
        />
        <button type="submit" className="btn btn--primary btn--block" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </AuthLayout>
  );
}
