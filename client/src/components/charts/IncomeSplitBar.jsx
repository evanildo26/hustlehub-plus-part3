import { formatCurrency, formatPercent } from '../../utils/format';

/**
 * Part-to-whole: of everything clients paid this tax year, how much went to
 * the platform fee, how much should be set aside for SARS, and what the
 * freelancer actually keeps. One 100% bar with a legend that carries every
 * value, so nothing relies on colour or hovering alone.
 */
const W = 600;
const H = 24;
const GAP = 2;
const R = 4;

export default function IncomeSplitBar({ gross, platformFees, tax, takeHome }) {
  const parts = [
    { key: 'takehome', label: 'You keep', value: takeHome },
    { key: 'tax', label: 'Set aside for tax', value: tax },
    { key: 'fee', label: 'Platform fee (10%)', value: platformFees },
  ].filter((p) => p.value > 0);

  const total = parts.reduce((s, p) => s + p.value, 0);
  if (total <= 0) return <p className="muted">Nothing earned yet this tax year.</p>;

  const usable = W - GAP * (parts.length - 1);
  let x = 0;
  const segments = parts.map((p, i) => {
    const w = (p.value / total) * usable;
    const seg = { ...p, x, w, first: i === 0, last: i === parts.length - 1 };
    x += w + GAP;
    return seg;
  });

  return (
    <figure className="chart split">
      <svg viewBox={`0 0 ${W} ${H}`} className="split__svg" role="img" aria-label={`Of ${formatCurrency(gross)} paid by clients: ${parts.map((p) => `${p.label} ${formatCurrency(p.value)}`).join(', ')}`}>
        <defs>
          <clipPath id="split-clip">
            <rect x="0" y="0" width={W} height={H} rx={R} />
          </clipPath>
        </defs>
        <g clipPath="url(#split-clip)">
          {segments.map((s) => (
            <rect key={s.key} className={`chart__bar chart__bar--${s.key}`} x={s.x} y="0" width={Math.max(0, s.w)} height={H}>
              <title>{`${s.label}: ${formatCurrency(s.value)} (${formatPercent(s.value / total)})`}</title>
            </rect>
          ))}
        </g>
      </svg>
      <ul className="split__legend">
        {parts.map((p) => (
          <li key={p.key}>
            <span className={`legend-swatch legend-swatch--${p.key}`} aria-hidden="true" />
            <span className="split__label">{p.label}</span>
            <strong>{formatCurrency(p.value)}</strong>
            <span className="muted small">{formatPercent(p.value / total, 0)}</span>
          </li>
        ))}
      </ul>
      <figcaption className="muted small">Based on {formatCurrency(gross)} paid by clients this tax year.</figcaption>
    </figure>
  );
}
