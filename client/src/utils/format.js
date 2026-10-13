const currency = new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' });
const date = new Intl.DateTimeFormat('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
const monthLabel = new Intl.DateTimeFormat('en-ZA', { month: 'long', year: 'numeric' });

/** R 1 234,50 style South African Rand formatting. */
export const formatCurrency = (value) => currency.format(Number(value) || 0);

export const formatDate = (value) => (value ? date.format(new Date(value)) : '-');

const dateTime = new Intl.DateTimeFormat('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
/** "13 Oct, 14:05" - for event logs. */
export const formatDateTime = (value) => (value ? dateTime.format(new Date(value)) : '-');

/** "2026-10" -> "October 2026" */
export const formatMonth = (yyyyMm) => {
  const [y, m] = yyyyMm.split('-').map(Number);
  return monthLabel.format(new Date(y, m - 1, 1));
};

export const capitalise = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

const compactNumber = new Intl.NumberFormat('en-ZA', { notation: 'compact', maximumFractionDigits: 1 });

/** Axis-friendly money: R0, R950, R12.5K, R1.2M */
export const formatCompactCurrency = (value) => `R${compactNumber.format(Number(value) || 0)}`;

/** 0.1352 -> "13.5%" */
export const formatPercent = (ratio, digits = 1) => `${((Number(ratio) || 0) * 100).toFixed(digits)}%`;

/** "2026-10" -> "Oct", or "O" when `narrow` (chart axis labels on small screens) */
export const formatMonthShort = (yyyyMm, narrow = false) => {
  const [y, m] = yyyyMm.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('en-ZA', { month: narrow ? 'narrow' : 'short' });
};
