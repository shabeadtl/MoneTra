import { format, parseISO } from 'date-fns';

export const currencies = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };

export function money(value, currency = 'INR') {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value || 0));
}

export function prettyDate(value) {
  if (!value) return '';
  return format(typeof value === 'string' ? parseISO(value) : value, 'dd MMM yyyy');
}

export function csvDownload(rows) {
  const quote = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const header = ['Date', 'Type', 'Title', 'Category', 'Amount', 'Notes', 'Recurring'];
  const lines = rows.map((tx) => [tx.date, tx.type, tx.title, tx.categories?.name || '', tx.amount, tx.notes || '', tx.is_recurring ? 'Yes' : 'No'].map(quote).join(','));
  const blob = new Blob([[header.map(quote).join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'expense_report.csv';
  link.click();
  URL.revokeObjectURL(url);
}

export function messageFrom(error) {
  return error?.message || 'Something went wrong. Please try again.';
}
