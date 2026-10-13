import { useEffect, useRef, useState } from 'react';
import { formatCompactCurrency, formatCurrency, formatMonth, formatMonthShort } from '../../utils/format';

/**
 * Stacked columns, one per month of the SA tax year: what the freelancer
 * keeps (take-home) with the estimated tax to set aside on top, so the full
 * column height is their net income for that month.
 *
 * Plain SVG (no chart library): every colour comes from CSS classes and
 * positions are SVG attributes, so it works under the strict production
 * CSP (style-src 'self'). The tooltip is positioned through React's style
 * prop, which writes to the CSSOM and is not affected by CSP.
 *
 * The SVG is drawn at the container's real pixel width (measured with a
 * ResizeObserver) rather than scaled, so labels stay readable on a phone
 * and columns keep their 24px cap on a wide screen.
 */
const M = { top: 22, right: 8, bottom: 28, left: 52 };
const GAP = 2; // Surface gap between stacked segments.
const RADIUS = 4; // Rounded data-end, square at the baseline.

/** Rounds the axis maximum up to a clean value (1, 2, 2.5 or 5 x 10^n). */
function niceMax(value) {
  if (value <= 0) return 1000;
  const exp = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * exp >= value);
  return step * exp;
}

/** Column path with a rounded top and a square base. */
function columnPath(x, y, w, h, roundTop) {
  if (h <= 0) return '';
  const r = roundTop ? Math.min(RADIUS, h, w / 2) : 0;
  return [
    `M${x},${y + h}`,
    `V${y + r}`,
    r ? `Q${x},${y} ${x + r},${y}` : '',
    `H${x + w - r}`,
    r ? `Q${x + w},${y} ${x + w},${y + r}` : '',
    `V${y + h}`,
    'Z',
  ].join(' ');
}

/** Width of the element in CSS pixels, kept up to date as it resizes. */
function useWidth(fallback) {
  const ref = useRef(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined; // jsdom/old browsers: keep the fallback width.
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.round(entry.contentRect.width))));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

export default function MonthlyTaxChart({ months }) {
  const [active, setActive] = useState(null);
  const [showTable, setShowTable] = useState(false);
  const [plotRef, W] = useWidth(720);
  const H = W < 520 ? 220 : 260;
  const PLOT_W = W - M.left - M.right;
  const PLOT_H = H - M.top - M.bottom;

  const yMax = niceMax(Math.max(...months.map((m) => m.netIncome), 0));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * yMax);
  const band = PLOT_W / months.length;
  const barW = Math.min(24, band * 0.6);
  const narrowLabels = band < 38; // "Sept" at 11px needs ~30px; below that use J F M A ... initials.
  const y = (v) => M.top + PLOT_H - (Math.max(0, v) / yMax) * PLOT_H;

  const peak = months.reduce((best, m, i) => (m.netIncome > (best === null ? 0 : months[best].netIncome) ? i : best), null);
  const activeMonth = active === null ? null : months[active];

  return (
    <figure className="chart">
      <div className="chart__legend" aria-hidden="true">
        <span className="legend-item">
          <span className="legend-swatch legend-swatch--takehome" />
          Take-home
        </span>
        <span className="legend-item">
          <span className="legend-swatch legend-swatch--tax" />
          Tax to set aside
        </span>
      </div>

      <div className="chart__plot" ref={plotRef}>
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="chart__svg" role="img" aria-label="Monthly net income split into take-home pay and estimated tax for this tax year">
          {ticks.map((t) => (
            <g key={t}>
              <line className="chart__grid" x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} />
              <text className="chart__tick" x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end">
                {formatCompactCurrency(t)}
              </text>
            </g>
          ))}

          {months.map((m, i) => {
            const cx = M.left + band * i + band / 2;
            const x = cx - barW / 2;
            const total = Math.max(0, m.netIncome);
            const keep = Math.max(0, m.afterTax);
            const keepTop = y(keep);
            const keepH = M.top + PLOT_H - keepTop;
            const taxTop = y(total);
            const taxH = keepTop - taxTop - (keepH > 0 ? GAP : 0);
            const hasTax = taxH > 0.5;
            return (
              <g
                key={m.month}
                className={`chart__col${active === i ? ' is-active' : ''}${m.elapsed ? '' : ' is-future'}`}
                tabIndex={0}
                aria-label={`${formatMonth(m.month)}: net income ${formatCurrency(m.netIncome)}, take-home ${formatCurrency(m.afterTax)}, tax to set aside ${formatCurrency(m.estimatedTax)}`}
                onPointerEnter={() => setActive(i)}
                onPointerLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
              >
                <rect className="chart__hit" x={M.left + band * i} y={M.top} width={band} height={PLOT_H} />
                <path className="chart__bar chart__bar--takehome" d={columnPath(x, keepTop, barW, keepH, !hasTax)} />
                {hasTax && <path className="chart__bar chart__bar--tax" d={columnPath(x, taxTop, barW, taxH, true)} />}
                {i === peak && total > 0 && (
                  <text className="chart__value" x={cx} y={taxTop - 6} textAnchor="middle">
                    {formatCompactCurrency(total)}
                  </text>
                )}
                <text className="chart__tick" x={cx} y={H - 8} textAnchor="middle">
                  {formatMonthShort(m.month, narrowLabels)}
                </text>
              </g>
            );
          })}

          <line className="chart__baseline" x1={M.left} x2={W - M.right} y1={M.top + PLOT_H} y2={M.top + PLOT_H} />
        </svg>

        {activeMonth && (
          <div
            className="chart__tooltip"
            role="status"
            style={{ left: `${((M.left + band * active + band / 2) / W) * 100}%` }}
          >
            <p className="chart__tooltip-title">{formatMonth(activeMonth.month)}</p>
            <p>
              <span className="tooltip-key tooltip-key--takehome" />
              <strong>{formatCurrency(activeMonth.afterTax)}</strong> take-home
            </p>
            <p>
              <span className="tooltip-key tooltip-key--tax" />
              <strong>{formatCurrency(activeMonth.estimatedTax)}</strong> tax
            </p>
            <p className="muted small">Net income {formatCurrency(activeMonth.netIncome)}</p>
          </div>
        )}
      </div>

      <figcaption className="chart__footer">
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setShowTable((v) => !v)} aria-expanded={showTable}>
          {showTable ? 'Hide table' : 'Show as table'}
        </button>
      </figcaption>

      {showTable && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Month</th>
                <th scope="col" className="num">Net income</th>
                <th scope="col" className="num">Tax to set aside</th>
                <th scope="col" className="num">Take-home</th>
              </tr>
            </thead>
            <tbody>
              {months.map((m) => (
                <tr key={m.month}>
                  <td>{formatMonth(m.month)}</td>
                  <td className="num">{formatCurrency(m.netIncome)}</td>
                  <td className="num">{formatCurrency(m.estimatedTax)}</td>
                  <td className="num">{formatCurrency(m.afterTax)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </figure>
  );
}
