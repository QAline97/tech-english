// Dates are stored as local "YYYY-MM-DD" strings so they compare correctly as text.

function format(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function today() {
  return format(new Date());
}

export function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return format(new Date(y, m - 1, d + days));
}
