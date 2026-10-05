import { CircleCheck } from 'lucide-react';

const POINTS = [
  'Freelancers track every rand they earn on a live dashboard',
  'Every booking recorded with a payment reference',
  'Your data protected with HTTPS, hashing and strict access control',
];

/** Split-screen layout for the login and registration pages. */
export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <section className="auth">
      <div className="auth__panel" aria-hidden="true">
        <div className="auth__panel-inner">
          <p className="auth__panel-eyebrow">HustleHub+</p>
          <p className="auth__panel-title">Where South African talent meets opportunity.</p>
          <ul className="auth__points">
            {POINTS.map((p) => (
              <li key={p}>
                <CircleCheck size={18} />
                {p}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="auth__form">
        <h1>{title}</h1>
        <p className="muted">{subtitle}</p>
        {children}
        {footer && <p className="muted center auth__footer">{footer}</p>}
      </div>
    </section>
  );
}
