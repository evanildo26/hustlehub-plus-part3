import { formatCompactCurrency, formatCurrency, formatPercent } from '../../utils/format';

/**
 * Shows how the projected annual income fills the SARS brackets: one row per
 * bracket, bar length = income falling in that bracket, value at the tip.
 * Makes "marginal vs effective rate" concrete - only the slice of income
 * inside a bracket is taxed at that bracket's rate.
 */
export default function TaxBracketBars({ brackets }) {
  // Show every bracket up to the one the freelancer is in, plus the next one for context.
  const currentIndex = Math.max(0, brackets.findIndex((b) => b.isCurrent));
  const rows = brackets.slice(0, Math.min(brackets.length, currentIndex + 2));
  const max = Math.max(...rows.map((b) => b.incomeInBracket), 1);

  return (
    <ul className="brackets" aria-label="Projected income in each tax bracket">
      {rows.map((b) => {
        const range = b.to === null ? `${formatCompactCurrency(b.from)}+` : `${formatCompactCurrency(b.from)}–${formatCompactCurrency(b.to)}`;
        const pct = (b.incomeInBracket / max) * 100;
        return (
          <li key={b.from} className={`brackets__row${b.isCurrent ? ' is-current' : ''}`}>
            <span className="brackets__rate">{formatPercent(b.rate, 0)}</span>
            <span className="brackets__range muted small">{range}</span>
            <span className="brackets__track">
              {b.incomeInBracket > 0 && <span className="brackets__bar" style={{ width: `${Math.max(pct, 1.5)}%` }} />}
            </span>
            <span className="brackets__value small">
              {b.incomeInBracket > 0 ? (
                <>
                  <strong>{formatCurrency(b.incomeInBracket)}</strong> → {formatCurrency(b.taxInBracket)} tax
                </>
              ) : (
                <span className="muted">Not reached</span>
              )}
            </span>
            {b.isCurrent && <span className="badge brackets__badge">Your top bracket</span>}
          </li>
        );
      })}
    </ul>
  );
}
