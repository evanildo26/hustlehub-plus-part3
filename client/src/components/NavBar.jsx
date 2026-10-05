import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { capitalise } from '../utils/format';

/** Role-aware navigation: each role only sees links to the pages it can use. */
const LINKS = {
  client: [
    { to: '/', label: 'Browse gigs', end: true },
    { to: '/bookings', label: 'My bookings' },
    { to: '/transactions', label: 'Payments' },
  ],
  freelancer: [
    { to: '/', label: 'Marketplace', end: true },
    { to: '/my-gigs', label: 'My gigs' },
    { to: '/bookings', label: 'Bookings' },
    { to: '/earnings', label: 'Earnings' },
    { to: '/transactions', label: 'Transactions' },
  ],
  admin: [
    { to: '/', label: 'Marketplace', end: true },
    { to: '/admin', label: 'Admin' },
    { to: '/bookings', label: 'All bookings' },
    { to: '/transactions', label: 'All transactions' },
  ],
};

export default function NavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const links = user ? LINKS[user.role] || [] : [{ to: '/', label: 'Browse gigs', end: true }];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="nav">
      <div className="nav__inner">
        <Link to="/" className="nav__brand">
          HustleHub<span>+</span>
        </Link>
        <nav aria-label="Main">
          <ul className="nav__links">
            {links.map((l) => (
              <li key={l.to}>
                <NavLink to={l.to} end={l.end}>
                  {l.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="nav__account">
          {user ? (
            <>
              <span className="nav__user">
                {user.name} <span className={`role role--${user.role}`}>{capitalise(user.role)}</span>
              </span>
              <button type="button" className="btn btn--ghost btn--sm" onClick={handleLogout}>
                Log out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn--ghost btn--sm">
                Log in
              </Link>
              <Link to="/register" className="btn btn--primary btn--sm">
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
