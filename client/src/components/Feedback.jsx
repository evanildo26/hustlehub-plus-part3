/** Small presentational helpers for alerts, loading and empty states. */

export function Alert({ type = 'error', children }) {
  if (!children) return null;
  return (
    <div className={`alert alert--${type}`} role={type === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}

export function Loader({ label = 'Loading…' }) {
  return (
    <div className="loader" role="status" aria-live="polite">
      <span className="loader__spinner" aria-hidden="true" />
      {label}
    </div>
  );
}

export function EmptyState({ title, children }) {
  return (
    <div className="empty">
      <p className="empty__title">{title}</p>
      {children && <div className="empty__body">{children}</div>}
    </div>
  );
}

export function StatusBadge({ status }) {
  return <span className={`badge badge--${status}`}>{status}</span>;
}
