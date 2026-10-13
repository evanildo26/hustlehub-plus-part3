import { useEffect, useState } from 'react';
import { AlertTriangle, Ban, KeyRound, Lock, ShieldAlert, Syringe, Timer } from 'lucide-react';
import { api } from '../api/client';
import { Alert, Loader } from './Feedback';
import StatCard from './StatCard';
import { formatDateTime } from '../utils/format';

/** Readable names for the security events the API records. */
const EVENT_LABELS = {
  LOGIN_SUCCESS: 'Login',
  LOGIN_FAILED: 'Failed login',
  LOGIN_BLOCKED_LOCKED: 'Login blocked (locked)',
  ACCOUNT_LOCKED: 'Account locked',
  LOGOUT: 'Logout',
  REGISTER_SUCCESS: 'Registration',
  ACCESS_DENIED: 'Access denied (role)',
  OWNERSHIP_VIOLATION: 'Access denied (not owner)',
  INVALID_TOKEN_ATTEMPT: 'Invalid token',
  REVOKED_TOKEN_USED: 'Revoked token used',
  SESSIONS_REVOKED: 'Sessions revoked',
  NOSQL_INJECTION_ATTEMPT: 'Injection attempt',
  RATE_LIMIT_EXCEEDED: 'Rate limit hit',
  SECURITY_ALERT: 'Security alert',
};

const PATTERN_LABELS = {
  BRUTE_FORCE_LOGIN: 'Possible brute-force login attack',
  ACCESS_PROBING: 'Probing for data it is not allowed to see',
  INJECTION_ATTEMPTS: 'Repeated injection attempts',
  TOKEN_TAMPERING: 'Repeated invalid or revoked tokens',
  SUSPICIOUS_ACTIVITY: 'Unusual volume of suspicious requests',
};

const WINDOWS = [
  { hours: 24, label: 'Last 24 hours' },
  { hours: 168, label: 'Last 7 days' },
  { hours: 720, label: 'Last 30 days' },
];

/** One short, human-readable line of context for an event (all values are rendered as text). */
function describe(e) {
  const d = e.details || {};
  if (e.event === 'SECURITY_ALERT') return `${PATTERN_LABELS[d.pattern] || d.pattern} · ${d.eventCount} events in ${d.windowMinutes} min`;
  const parts = [d.email, d.reason && d.reason.replaceAll('_', ' '), d.limiter && `${d.limiter} limiter`, d.required && `needs ${[].concat(d.required).join('/')}`, d.path || e.path];
  return parts.filter(Boolean).join(' · ');
}

/**
 * Admin Security monitor: what the API's security monitor has recorded
 * (GET /api/admin/security-events). Alerts are shown first with an icon and
 * a label, never colour alone.
 */
export default function SecurityMonitor() {
  const [hours, setHours] = useState(24);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    api
      .securityEvents(hours)
      .then((res) => {
        setData(res.data);
        setError('');
      })
      .catch((err) => setError(err.message))
      .finally(() => setRefreshing(false));
  }, [hours]);

  if (!data) return error ? <Alert>{error}</Alert> : <Loader label="Loading security events…" />;
  const t = data.totals;

  const tiles = [
    { icon: KeyRound, label: 'Failed logins', value: t.failedLogins, hint: `${t.successfulLogins} successful` },
    { icon: Lock, label: 'Accounts locked', value: t.accountsLocked, hint: `${t.currentlyLocked} locked right now` },
    { icon: Ban, label: 'Access denied', value: t.accessDenied, hint: 'Wrong role or not the owner' },
    { icon: Syringe, label: 'Injection attempts', value: t.injectionAttempts, hint: 'NoSQL operators stripped' },
    { icon: ShieldAlert, label: 'Bad or revoked tokens', value: t.invalidTokens, hint: 'Forged, expired or logged out' },
    { icon: Timer, label: 'Rate limited', value: t.rateLimited, hint: '429 responses' },
  ];

  return (
    <section className="card security" aria-labelledby="security-heading">
      <div className="security__header">
        <div>
          <h2 id="security-heading">Security monitor</h2>
          <p className="muted small">Security events recorded by the API. The full log also streams to Better Stack.</p>
        </div>
        <div className="field field--inline">
          <label htmlFor="security-window">Period</label>
          <select
            id="security-window"
            value={hours}
            onChange={(e) => {
              setRefreshing(true);
              setHours(Number(e.target.value));
            }}
          >
            {WINDOWS.map((w) => (
              <option key={w.hours} value={w.hours}>
                {w.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Alert>{error}</Alert>

      <div className={`security__body${refreshing ? ' is-refreshing' : ''}`}>
        {data.alerts.length > 0 ? (
          <ul className="alerts" aria-label="Security alerts">
            {data.alerts.map((a) => (
              <li key={a.id} className="alerts__item">
                <AlertTriangle size={18} aria-hidden="true" />
                <span>
                  <strong>Alert: {PATTERN_LABELS[a.details?.pattern] || 'Suspicious activity'}</strong>
                  <span className="small">
                    {a.details?.eventCount} events from {a.ip} in {a.details?.windowMinutes} minutes · {formatDateTime(a.createdAt)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="alerts__none small">No security alerts in this period.</p>
        )}

        <div className="stats stats--compact">
          {tiles.map((tile) => (
            <StatCard key={tile.label} {...tile} />
          ))}
        </div>

        <div className="two-col">
          <div>
            <h3>Recent events</h3>
            <div className="table-wrap">
              <table className="table table--compact">
                <thead>
                  <tr>
                    <th scope="col">Time</th>
                    <th scope="col">Event</th>
                    <th scope="col">IP</th>
                    <th scope="col">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentEvents.length === 0 && (
                    <tr>
                      <td colSpan={4} className="muted">
                        No security events in this period.
                      </td>
                    </tr>
                  )}
                  {data.recentEvents.slice(0, 20).map((e) => (
                    <tr key={e.id} className={e.level === 'alert' ? 'is-alert' : undefined}>
                      <td className="nowrap">{formatDateTime(e.createdAt)}</td>
                      <td>{EVENT_LABELS[e.event] || e.event}</td>
                      <td className="nowrap">{e.ip || '-'}</td>
                      <td className="muted">{describe(e)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <h3>Most active sources</h3>
            <p className="muted small">IPs with the most failed logins, denials and injection attempts.</p>
            {data.topIps.length === 0 ? (
              <p className="muted small">Nothing suspicious recorded.</p>
            ) : (
              <ol className="top-list">
                {data.topIps.map((ip) => (
                  <li key={ip.ip}>
                    <span>{ip.ip}</span>
                    <strong>{ip.count}</strong>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
