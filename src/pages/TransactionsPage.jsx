import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Download, Edit3, Plus, ReceiptText, Search, Trash2, X } from 'lucide-react';
import Modal from '../components/Modal';
import TransactionForm from '../components/TransactionForm';
import EmptyState from '../components/EmptyState';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useDataStore } from '../stores/dataStore';
import { csvDownload, money, prettyDate } from '../lib/utils';
import ConfirmDialog from '../components/ConfirmDialog';
import Toast from '../components/Toast';

const PAGE_SIZE = 10;
const DEFAULT_FILTERS = { q: '', type: '', category: '', account: '', from: '', to: '', sort: 'date-desc' };

function formatSigned(amount, type, currency) {
  const m = money(amount, currency);
  return type === 'INCOME' ? `+${m}` : `-${m}`;
}

export default function TransactionsPage() {
  const currency = useAuthStore((s) => s.profile?.currency || 'INR');
  const { transactions, categories, accounts, deleteTransaction } = useDataStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [edit, setEdit] = useState(null);
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState(() => ({
    ...DEFAULT_FILTERS,
    account: searchParams.get('account') || '',
  }));
  const [confirmTx, setConfirmTx] = useState(null);
  const [toast, setToast] = useState('');

  // PWA shortcut: /transactions?new=1 opens the Add Transaction modal
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const activeFilterCount =
    [filters.q, filters.type, filters.category, filters.account, filters.from, filters.to].filter(Boolean).length +
    (filters.sort !== DEFAULT_FILTERS.sort ? 1 : 0);

  const filtered = useMemo(() => {
    const q = filters.q.toLowerCase().trim();
    return transactions
      .filter((t) =>
        (!q || [t.title, t.notes, t.categories?.name, t.type, t.amount].some((v) =>
          String(v || '').toLowerCase().includes(q)
        )) &&
        (!filters.type || t.type === filters.type) &&
        (!filters.category || t.category_id === filters.category) &&
        (!filters.account || t.account_id === filters.account) &&
        (!filters.from || t.date >= filters.from) &&
        (!filters.to   || t.date <= filters.to)
      )
      .sort((a, b) => {
        const [key, dir] = filters.sort.split('-');
        const av = key === 'amount' ? Number(a.amount) : a[key];
        const bv = key === 'amount' ? Number(b.amount) : b[key];
        return (av > bv ? 1 : av < bv ? -1 : 0) * (dir === 'asc' ? 1 : -1);
      });
  }, [transactions, filters]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const first = (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(page * PAGE_SIZE, filtered.length);

  const setFilter = (name, value) => { setFilters((f) => ({ ...f, [name]: value })); setPage(1); };
  const clearFilters = () => { setFilters(DEFAULT_FILTERS); setPage(1); };

  async function remove(tx) {
    await deleteTransaction(tx.id);
    setConfirmTx(null);
    setToast(`"${tx.title}" deleted`);
  }

  return (
    <div className="flex h-[calc(100dvh-12.5rem)] flex-col gap-4 overflow-hidden lg:h-[calc(100dvh-9rem)] lg:gap-5">
      {/* Header */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black">Transactions</h1>
          <p className="mt-1 text-slate-500">Search, filter, edit, and export your complete ledger.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => csvDownload(filtered)} disabled={!filtered.length}>
            <Download size={17} /> Export CSV
          </button>
          <button
            className="btn-primary shadow-[0_4px_20px_-4px_rgba(15,118,110,0.4)] transition hover:scale-[1.02] active:scale-95"
            onClick={() => setOpen(true)}
          >
            <Plus size={17} /> Add Transaction
          </button>
        </div>
      </div>

      {/* Filters */}
      <section className="card shrink-0">
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
          {/* Search */}
          <div className="relative lg:min-w-56 lg:flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              className="field pl-10"
              placeholder="Search everything…"
              value={filters.q}
              onChange={(e) => setFilter('q', e.target.value)}
            />
            {filters.q && (
              <button
                onClick={() => setFilter('q', '')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 transition hover:text-slate-600"
                title="Clear search"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Category */}
          <select className="field lg:w-44" value={filters.category} onChange={(e) => setFilter('category', e.target.value)}>
            <option value="">All categories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          {/* Account */}
          <select className="field lg:w-44" value={filters.account} onChange={(e) => setFilter('account', e.target.value)}>
            <option value="">All accounts</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>

          {/* Type */}
          <select className="field lg:w-36" value={filters.type} onChange={(e) => setFilter('type', e.target.value)}>
            <option value="">All types</option>
            <option value="INCOME">Income</option>
            <option value="EXPENSE">Expense</option>
          </select>

          {/* Date range */}
          <div className="flex items-end gap-2">
            <div>
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">From</span>
              <div className="relative">
                <input
                  className={`field w-36 [&::-webkit-calendar-picker-indicator]:hidden ${filters.from ? '' : 'text-transparent [&::-webkit-datetime-edit]:text-transparent'}`}
                  type="date"
                  value={filters.from}
                  onChange={(e) => setFilter('from', e.target.value)}
                  title="From date"
                />
                {!filters.from && (
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center gap-1.5 text-sm text-slate-400 dark:text-slate-500">
                    <CalendarDays size={14} /> Select date
                  </span>
                )}
                {filters.from && (
                  <button
                    onClick={() => setFilter('from', '')}
                    className="absolute right-2.5 top-2.5 rounded text-slate-400 transition hover:text-slate-600"
                    title="Clear from date"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
            </div>
            <div>
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">To</span>
              <div className="relative">
                <input
                  className={`field w-36 [&::-webkit-calendar-picker-indicator]:hidden ${filters.to ? '' : 'text-transparent [&::-webkit-datetime-edit]:text-transparent'}`}
                  type="date"
                  value={filters.to}
                  onChange={(e) => setFilter('to', e.target.value)}
                  title="To date"
                />
                {!filters.to && (
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center gap-1.5 text-sm text-slate-400 dark:text-slate-500">
                    <CalendarDays size={14} /> Select date
                  </span>
                )}
                {filters.to && (
                  <button
                    onClick={() => setFilter('to', '')}
                    className="absolute right-2.5 top-2.5 rounded text-slate-400 transition hover:text-slate-600"
                    title="Clear to date"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Sort */}
          <select className="field lg:w-44" value={filters.sort} onChange={(e) => setFilter('sort', e.target.value)}>
            <option value="date-desc">Newest first</option>
            <option value="date-asc">Oldest first</option>
            <option value="amount-desc">Amount high–low</option>
            <option value="amount-asc">Amount low–high</option>
            <option value="title-asc">Title A–Z</option>
          </select>

          {/* Clear filters */}
          {activeFilterCount > 0 && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-slate-700 dark:hover:border-red-900/30 dark:hover:bg-red-950/40 dark:hover:text-red-300"
            >
              <X size={15} />
              Clear {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''}
            </button>
          )}
        </div>
      </section>

      {/* Table */}
      <section className="card flex min-h-0 flex-1 flex-col overflow-hidden p-0">
        {/* Scrollable body */}
        <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
        {/* Desktop table */}
        <div className="hidden md:block">
          <table className="w-full border-separate border-spacing-0 text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {['Date', 'Title', 'Category', 'Account', 'Type', 'Amount', ''].map((x) => (
                  <th
                    className={`sticky top-0 z-10 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-5 py-3 font-semibold dark:border-slate-700 dark:bg-slate-800 ${x === 'Amount' ? 'text-right' : ''}`}
                    key={x}
                  >
                    {x}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((t) => (
                <tr key={t.id} className="group transition hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="whitespace-nowrap px-5 py-4 text-slate-500">{prettyDate(t.date)}</td>
                  <td className="px-5 py-4">
                    <p className="font-semibold">{t.title}</p>
                    {t.notes && <p className="mt-0.5 max-w-[200px] truncate text-xs text-slate-400">{t.notes}</p>}
                    {t.local_only && <span className="mt-0.5 block text-xs font-medium text-amber-600">⏳ Waiting to sync</span>}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700/60 dark:bg-slate-800/80 dark:text-slate-200"
                    >
                      <i className="h-1.5 w-1.5 rounded-full" style={{ background: t.categories?.color || '#64748B' }} />
                      {t.categories?.name || '—'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    {t.accounts?.name ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700/60 dark:bg-slate-800/80 dark:text-slate-200">
                        <i className="h-1.5 w-1.5 rounded-full" style={{ background: t.accounts?.color || '#64748B' }} />
                        {t.accounts.name}
                      </span>
                    ) : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
                        t.type === 'INCOME'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                      }`}
                    >
                      {t.type === 'INCOME' ? '↑ Income' : '↓ Expense'}
                    </span>
                  </td>
                  <td className={`px-5 py-4 text-right font-bold tabular-nums ${t.type === 'INCOME' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-200'}`}>
                    {formatSigned(t.amount, t.type, currency)}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-1">
                      <button
                        className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-brand-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-slate-700 dark:hover:text-brand-300"
                        onClick={() => setEdit(t)}
                        disabled={t.local_only}
                        title="Edit"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        className="rounded-lg p-2 text-slate-500 transition hover:bg-red-50 hover:text-red-600 active:scale-95 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                        onClick={() => setConfirmTx(t)}
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="divide-y md:hidden">
          {rows.map((t) => (
            <article className="p-4" key={t.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{t.title}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {prettyDate(t.date)}
                    {t.categories?.name && <> · <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 font-semibold text-slate-700 dark:border-slate-700/60 dark:bg-slate-800/80 dark:text-slate-200">
                      <i className="h-1.5 w-1.5 rounded-full" style={{ background: t.categories?.color }} />
                      {t.categories?.name}
                    </span></>}
                    {t.accounts?.name && <> · <span className="text-slate-500">{t.accounts.name}</span></>}
                  </p>
                  {t.local_only && <p className="mt-1 text-xs font-medium text-amber-600">⏳ Waiting to sync</p>}
                </div>
                <div className="text-right">
                  <p className={`font-bold tabular-nums ${t.type === 'INCOME' ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
                    {formatSigned(t.amount, t.type, currency)}
                  </p>
                  <span className={`chip mt-1 ${t.type === 'INCOME' ? 'chip-income' : 'chip-expense'}`}>
                    {t.type === 'INCOME' ? 'Income' : 'Expense'}
                  </span>
                </div>
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => setEdit(t)} disabled={t.local_only}>Edit</button>
                <button className="btn-danger px-3 py-1.5 text-xs" onClick={() => setConfirmTx(t)}>Delete</button>
              </div>
            </article>
          ))}
        </div>

          {!rows.length && (
            <EmptyState
              icon={ReceiptText}
              title="No matching transactions"
              message="Try changing your filters or add a new transaction."
            />
          )}
        </div>

        {/* Footer */}
        {filtered.length > 0 && (
        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t px-5 py-3 text-sm">
          <span className="text-slate-500">
            Showing <b className="font-semibold text-slate-700 dark:text-slate-300">{first}–{last}</b> of{' '}
            <b className="font-semibold text-slate-700 dark:text-slate-300">{filtered.length}</b> transaction{filtered.length === 1 ? '' : 's'}
          </span>
          <div className="flex items-center gap-2">
            <button
              className="btn-secondary px-2 py-2"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft size={17} />
            </button>
            <span className="min-w-[60px] text-center text-sm font-medium">
              Page {page} / {pages}
            </span>
            <button
              className="btn-secondary px-2 py-2"
              disabled={page === pages}
              onClick={() => setPage(page + 1)}
              aria-label="Next page"
            >
              <ChevronRight size={17} />
            </button>
          </div>
        </footer>
        )}
      </section>

      <Modal
        open={open || Boolean(edit)}
        onClose={() => { setOpen(false); setEdit(null); }}
        title={edit ? 'Edit transaction' : 'Add transaction'}
      >
        <TransactionForm initial={edit} onDone={() => { setOpen(false); setEdit(null); setToast(edit ? 'Transaction updated' : 'Transaction added'); }} />
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmTx)}
        title="Delete transaction?"
        message={`"${confirmTx?.title}" will be permanently deleted. This cannot be undone.`}
        onConfirm={() => confirmTx && remove(confirmTx)}
        onCancel={() => setConfirmTx(null)}
      />

      <Toast message={toast} onClose={() => setToast('')} />
    </div>
  );
}
