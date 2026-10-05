import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import ConfirmButton from '../components/ConfirmButton';
import { CalendarCheck, LayoutGrid, Users, Wallet } from 'lucide-react';
import { Alert, Loader } from '../components/Feedback';
import StatCard from '../components/StatCard';
import { capitalise, formatCurrency, formatDate } from '../utils/format';

/** Admin oversight: platform stats, user list and gig moderation. */
export default function AdminPage() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [gigs, setGigs] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    Promise.all([api.adminStats(), api.adminUsers(), api.adminGigs()])
      .then(([s, u, g]) => {
        setStats(s.data);
        setUsers(u.data);
        setGigs(g.data);
      })
      .catch((err) => setError(err.message));
  }, []);

  const removeGig = async (gig) => {
    setError('');
    try {
      await api.deleteGig(gig.id);
      setGigs((list) => list.filter((g) => g.id !== gig.id));
      setNotice(`Removed "${gig.title}".`);
    } catch (err) {
      setError(err.message);
    }
  };

  if (error && !stats) return <Alert>{error}</Alert>;
  if (!stats) return <Loader label="Loading admin dashboard…" />;

  return (
    <section className="page">
      <h1>Admin dashboard</h1>
      <p className="muted">Platform oversight and moderation.</p>
      <Alert>{error}</Alert>
      <Alert type="success">{notice}</Alert>

      <div className="stats">
        <StatCard
          icon={Users}
          label="Users"
          value={stats.users.client + stats.users.freelancer + stats.users.admin}
          hint={`${stats.users.client} clients · ${stats.users.freelancer} freelancers · ${stats.users.admin} admins`}
        />
        <StatCard icon={LayoutGrid} label="Gigs" value={stats.gigs} hint="Listed and unlisted" />
        <StatCard icon={CalendarCheck} label="Bookings" value={stats.bookings} hint="All time" />
        <StatCard
          icon={Wallet}
          label="Platform revenue"
          value={formatCurrency(stats.platformRevenue)}
          hint={`from ${formatCurrency(stats.transactionVolume)} transaction volume`}
          tone="primary"
        />
      </div>

      <div className="card">
        <h2>Gig moderation</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Gig</th>
                <th scope="col">Freelancer</th>
                <th scope="col">Price</th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {gigs.map((g) => (
                <tr key={g.id}>
                  <td>{g.isActive ? <Link to={`/gigs/${g.id}`}>{g.title}</Link> : g.title}</td>
                  <td>{g.freelancer?.name}</td>
                  <td>{formatCurrency(g.price)}</td>
                  <td>
                    <span className={`badge ${g.isActive ? 'badge--completed' : 'badge--cancelled'}`}>{g.isActive ? 'Listed' : 'Unlisted'}</span>
                  </td>
                  <td className="actions">
                    <ConfirmButton onConfirm={() => removeGig(g)} confirmLabel="Remove">
                      Remove
                    </ConfirmButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2>Users</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Email</th>
                <th scope="col">Role</th>
                <th scope="col">Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>
                    <span className={`role role--${u.role}`}>{capitalise(u.role)}</span>
                  </td>
                  <td>{formatDate(u.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
