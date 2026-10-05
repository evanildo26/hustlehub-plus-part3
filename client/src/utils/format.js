const currency = new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' });
const date = new Intl.DateTimeFormat('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
const monthLabel = new Intl.DateTimeFormat('en-ZA', { month: 'long', year: 'numeric' });

/** R 1 234,50 style South African Rand formatting. */
export const formatCurrency = (value) => currency.format(Number(value) || 0);

export const formatDate = (value) => (value ? date.format(new Date(value)) : '-');

/** "2026-10" -> "October 2026" */
export const formatMonth = (yyyyMm) => {
  const [y, m] = yyyyMm.split('-').map(Number);
  return monthLabel.format(new Date(y, m - 1, 1));
};

export const capitalise = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
