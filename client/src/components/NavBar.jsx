import { useState } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { ChartColumn, LayoutGrid, LogOut, Menu, Receipt, Search, ShieldCheck, Store, CalendarCheck, Wallet, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { capitalise } from '../utils/format';
import Logo from './Logo';
import Avatar from './Avatar';

/** Role-aware navigation: each role only sees links to the pages it can use. */
const LINKS = {
  client: [
    { to: '/', label: 'Browse gigs', icon: Search, end: true },
    { to: '/bookings', label: 'My bookings', icon: CalendarCheck },
    { to: '/transactions', label: 'Payments', icon: Receipt },
  ],
  freelancer: [
    { to: '/', label: 'Marketplace', icon: Store, end: true },
    { to: '/my-gigs', label: 'My gigs', icon: LayoutGrid },
    { to: '/bookings', label: 'Bookings', icon: CalendarCheck },
    { to: '/earnings', label: 'Earnings', icon: Wallet },
    { to: '/transactions', label: 'Transactions', icon: Receipt },
  ],
  admin: [
    { to: '/', label: 'Marketplace', icon: Store, end: true },
    { to: '/admin', label: 'Admin', icon: ShieldCheck },
    { to: '/bookings', label: 'All bookings', icon: CalendarCheck },
    { to: '/transactions', label: 'All transactions', icon: ChartColumn },
  ],
};

export default function NavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const links = user ? LINKS[user.role] || [] : [{ to: '/', label: 'Browse gigs', icon: Search, end: true }];

  const handleLogout = async () => {
    setOpen(false);
    await logout(); // Wait for the server to revoke the token before leaving the page.
    navigate('/login');
  };

  return (
    <header className="nav">
      <div className="nav__inner">
        <Logo />
        <button
          type="button"
          className="nav__toggle"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls="main-menu"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
        <div id="main-menu" className={`nav__menu${open ? ' nav__menu--open' : ''}`}>
          <nav aria-label="Main">
            <ul className="nav__links">
              {links.map(({ to, label, icon: Icon, end }) => (
                <li key={to}>
                  <NavLink to={to} end={end} onClick={() => setOpen(false)}>
                    <Icon size={17} aria-hidden="true" />
                    {label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <div className="nav__account">
            {user ? (
              <>
                <span className="nav__user">
                  <Avatar name={user.name} size="sm" />
                  <span className="nav__user-text">
                    <span className="nav__user-name">{user.name}</span>
                    <span className={`role role--${user.role}`}>{capitalise(user.role)}</span>
                  </span>
                </span>
                <button type="button" className="btn btn--ghost btn--sm" onClick={handleLogout}>
                  <LogOut size={16} aria-hidden="true" />
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
      </div>
    </header>
  );
}
