import { Link } from 'react-router-dom';
import { Lock, ShieldCheck } from 'lucide-react';
import Logo from './Logo';
import { CATEGORY_META } from '../utils/categories';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer__inner">
        <div className="footer__brand">
          <Logo light />
          <p>A secure marketplace connecting South African freelancers with the clients who need them.</p>
          <p className="footer__secure">
            <Lock size={14} aria-hidden="true" /> HTTPS encrypted · <ShieldCheck size={14} aria-hidden="true" /> Role-based access
          </p>
        </div>
        <div>
          <h2 className="footer__heading">Categories</h2>
          <ul className="footer__links">
            {Object.entries(CATEGORY_META)
              .slice(0, 4)
              .map(([key, meta]) => (
                <li key={key}>{meta.label}</li>
              ))}
          </ul>
        </div>
        <div>
          <h2 className="footer__heading">HustleHub+</h2>
          <ul className="footer__links">
            <li>
              <Link to="/">Browse gigs</Link>
            </li>
            <li>
              <Link to="/register">Become a freelancer</Link>
            </li>
            <li>
              <Link to="/login">Log in</Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="footer__bottom">© 2026 HustleHub+ · INSY7314 / APDS7311 POE · Payments on this platform are simulated.</div>
    </footer>
  );
}
