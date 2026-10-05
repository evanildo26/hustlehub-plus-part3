/** Dashboard metric tile with an icon. `tone="primary"` highlights the headline number. */
export default function StatCard({ icon: Icon, label, value, hint, tone }) {
  return (
    <div className={`stat card${tone ? ` stat--${tone}` : ''}`}>
      {Icon && (
        <span className="stat__icon" aria-hidden="true">
          <Icon size={20} />
        </span>
      )}
      <p className="stat__label">{label}</p>
      <p className="stat__value">{value}</p>
      {hint && <p className="stat__hint">{hint}</p>}
    </div>
  );
}
