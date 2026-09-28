import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle, Pencil, PiggyBank, Plus, Target, Trash2 } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useDataStore } from '../stores/dataStore';
import { money, messageFrom } from '../lib/utils';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import ConfirmDialog from '../components/ConfirmDialog';
import Toast from '../components/Toast';
import Spinner from '../components/Spinner';

export default function BudgetsPage() {
  const now = new Date();
  const user = useAuthStore((s) => s.user);
  const currency = useAuthStore((s) => s.profile?.currency || 'INR');
  const { budgets, categories, accounts, transactions, saveBudget, deleteBudget, loading } = useDataStore();

  const [period, setPeriod] = useState({ month: now.getMonth() + 1, year: now.getFullYear() });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [form, setForm] = useState({ scope: 'CATEGORY', category_id: '', account_id: '', limit_amount: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  const expenseCategories = categories.filter((c) => !c.category_type || c.category_type === 'EXPENSE');

  const rows = useMemo(() =>
    budgets
      .filter((b) => b.month === Number(period.month) && b.year === Number(period.year))
      .map((b) => {
        const spent = transactions
          .filter((t) => {
            if (t.type !== 'EXPENSE' || t.transfer_id || Number(t.date.slice(0, 4)) !== b.year || Number(t.date.slice(5, 7)) !== b.month) return false;
            if (b.scope === 'CATEGORY') return t.category_id === b.category_id;
            if (b.scope === 'ACCOUNT') return t.account_id === b.account_id;
            return true;
          })
          .reduce((s, t) => s + Number(t.amount), 0);
        return { ...b, spent, percent: Math.min(100, (spent / Number(b.limit_amount)) * 100) };
      }),
  [budgets, transactions, period]);

  const months = Array.from({ length: 12 }, (_, i) =>
    new Date(2000, i).toLocaleString(undefined, { month: 'long' })
  );

  const accountName = (id) => accounts.find((a) => a.id === id)?.name || 'Account';

  async function submit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await saveBudget({
        user_id: user.id,
        scope: form.scope,
        category_id: form.scope === 'CATEGORY' ? form.category_id : null,
        account_id: form.scope === 'ACCOUNT' ? form.account_id : null,
        limit_amount: Number(form.limit_amount),
        month: Number(period.month),
        year: Number(period.year),
      });
      setOpen(false);
      setEditing(null);
      setForm({ scope: 'CATEGORY', category_id: '', account_id: '', limit_amount: '' });
      setToast(editing ? 'Budget updated' : 'Budget created');
    } catch (err) {
      setError(messageFrom(err));
    } finally {
      setSaving(false);
    }
  }

  // Summary stats
  const totalBudgeted = rows.reduce((s, b) => s + Number(b.limit_amount), 0);
  const totalSpent    = rows.reduce((s, b) => s + b.spent, 0);
  const overBudget    = rows.filter((b) => b.spent >= Number(b.limit_amount)).length;

  if (loading && !budgets.length) return <Spinner full label="Loading budgets…" />;

  const scopeBadge = (b) => {
    if (b.scope === 'ACCOUNT') {
      const acc = accounts.find((a) => a.id === b.account_id);
      return <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700/60 dark:bg-slate-800/80 dark:text-slate-200"><i className="h-1.5 w-1.5 rounded-full" style={{ background: acc?.color || '#64748B' }} />{accountName(b.account_id)}</span>;
    }
    if (b.scope === 'TOTAL') return <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700/60 dark:bg-slate-800/80 dark:text-slate-200"><i className="h-1.5 w-1.5 rounded-full" style={{ background: '#0D9488' }} />Overall</span>;
    return null;
  };

  return (
    <>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black">Budgets</h1>
          <p className="mt-1 text-slate-500">Set monthly limits per category, account, or overall — and spot pressure before it becomes a problem.</p>
        </div>
        <button className="btn-primary" onClick={() => { setEditing(null); setForm({ scope: 'CATEGORY', category_id: '', account_id: '', limit_amount: '' }); setOpen(true); }}>
          <Plus size={17} /> Set budget
        </button>
      </div>

      {/* Period picker */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <select
          className="field max-w-52"
          value={period.month}
          onChange={(e) => setPeriod({ ...period, month: Number(e.target.value) })}
        >
          {months.map((m, i) => <option value={i + 1} key={m}>{m}</option>)}
        </select>
        <input
          className="field max-w-32"
          type="number"
          min="2000"
          max="9999"
          value={period.year}
          onChange={(e) => setPeriod({ ...period, year: Number(e.target.value) })}
        />
        {rows.length > 0 && (
          <div className="ml-auto flex flex-wrap gap-3 text-sm">
            <div className="card !p-3 text-center">
              <p className="text-xs text-slate-500">Budgeted</p>
              <p className="mt-0.5 font-bold">{money(totalBudgeted, currency)}</p>
            </div>
            <div className="card !p-3 text-center">
              <p className="text-xs text-slate-500">Spent</p>
              <p className={`mt-0.5 font-bold ${totalSpent > totalBudgeted ? 'text-red-600' : ''}`}>
                {money(totalSpent, currency)}
              </p>
            </div>
            {overBudget > 0 && (
              <div className="card !p-3 text-center">
                <p className="text-xs text-slate-500">Over limit</p>
                <p className="mt-0.5 font-bold text-red-600">{overBudget} budget{overBudget > 1 ? 's' : ''}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Budget cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((b) => {
          const bad  = b.spent >= Number(b.limit_amount);
          const warn = b.spent >= Number(b.limit_amount) * 0.8;
          const remaining = Number(b.limit_amount) - b.spent;
          const acc = b.scope === 'ACCOUNT' ? accounts.find((a) => a.id === b.account_id) : null;
          const chipColor = b.scope === 'CATEGORY' ? b.categories?.color : b.scope === 'ACCOUNT' ? acc?.color : '#0D9488';
          const chipLabel = b.scope === 'CATEGORY' ? b.categories?.name?.[0]?.toUpperCase() : b.scope === 'ACCOUNT' ? acc?.name?.[0]?.toUpperCase() : 'Ω';

          return (
            <article className="card flex flex-col gap-4" key={b.id}>
              {/* Top row */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white text-sm font-bold shadow-sm"
                    style={{ background: chipColor || '#64748B' }}
                  >
                    {chipLabel}
                  </span>
                  <div>
                    <h2 className="font-bold">{b.scope === 'CATEGORY' ? b.categories?.name : b.scope === 'ACCOUNT' ? accountName(b.account_id) : 'Overall spending'}</h2>
                    {scopeBadge(b)}
                    <p className="mt-0.5 text-xs text-slate-500">
                      {money(b.spent, currency)} of {money(b.limit_amount, currency)}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-brand-700 dark:hover:bg-slate-800"
                    onClick={() => {
                      setEditing(b);
                      setForm({ scope: b.scope, category_id: b.category_id || '', account_id: b.account_id || '', limit_amount: String(b.limit_amount) });
                      setOpen(true);
                    }}
                    title="Edit budget limit"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                    onClick={() => setConfirmDelete(b)}
                    title="Delete budget"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {/* Progress bar */}
              <div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      bad ? 'bg-red-500' : warn ? 'bg-amber-500' : 'bg-brand-600'
                    }`}
                    style={{ width: `${b.percent}%` }}
                  />
                </div>
                <div className="mt-2 flex justify-between text-xs">
                  <span className={`font-semibold ${bad ? 'text-red-600' : warn ? 'text-amber-600' : 'text-slate-500'}`}>
                    {bad ? 'Limit exceeded' : warn ? 'Approaching limit' : 'On track'}
                  </span>
                  <span className="font-bold">{Math.round(b.percent)}%</span>
                </div>
              </div>

              {/* Alert / remaining */}
              {bad ? (
                <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700 dark:bg-red-950/30 dark:text-red-300">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  Over by {money(Math.abs(remaining), currency)}
                </div>
              ) : warn ? (
                <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs font-medium text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  {money(remaining, currency)} remaining — tread carefully.
                </div>
              ) : (
                <div className="flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-xs font-medium text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                  <CheckCircle size={14} className="mt-0.5 shrink-0" />
                  {money(remaining, currency)} still available
                </div>
              )}
            </article>
          );
        })}
      </div>

      {!rows.length && (
        <section className="card">
          <EmptyState
            icon={PiggyBank}
            title="No budgets for this period"
            message={`Create a budget for ${months[period.month - 1]} ${period.year} — per category, per account, or overall — to start tracking spending limits.`}
          />
        </section>
      )}

      {/* Set budget modal */}
      <Modal open={open} onClose={() => { setOpen(false); setEditing(null); setError(''); }} title={editing ? 'Edit budget' : 'Set monthly budget'}>
        <form className="space-y-4" onSubmit={submit}>
          {error && (
            <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </p>
          )}
          <div>
            <label className="label">Scope</label>
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
              {[['CATEGORY', 'Category'], ['ACCOUNT', 'Account'], ['TOTAL', 'Overall']].map(([key, label]) => (
                <button
                  type="button"
                  key={key}
                  onClick={() => setForm({ ...form, scope: key })}
                  className={`rounded-lg py-2 text-sm font-semibold transition ${form.scope === key ? 'bg-white shadow dark:bg-slate-700' : 'text-slate-500'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {form.scope === 'CATEGORY' && (
            <div>
              <label className="label">Category</label>
              <select
                className="field"
                required
                value={form.category_id}
                onChange={(e) => setForm({ ...form, category_id: e.target.value })}
              >
                <option value="">Choose category</option>
                {expenseCategories.map((c) => <option value={c.id} key={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          {form.scope === 'ACCOUNT' && (
            <div>
              <label className="label">Account</label>
              <select
                className="field"
                required
                value={form.account_id}
                onChange={(e) => setForm({ ...form, account_id: e.target.value })}
              >
                <option value="">Choose account</option>
                {accounts.filter((a) => !a.is_archived).map((a) => <option value={a.id} key={a.id}>{a.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="label">Limit amount</label>
            <input
              className="field"
              type="number"
              min="0.01"
              step="0.01"
              required
              value={form.limit_amount}
              onChange={(e) => setForm({ ...form, limit_amount: e.target.value })}
              placeholder="e.g. 5000"
            />
          </div>
          <p className="flex items-start gap-1.5 text-sm text-slate-500">
            <Target size={15} className="mt-0.5 shrink-0 text-brand-600 dark:text-brand-300" />
            For <strong>{months[period.month - 1]} {period.year}</strong>. Saving replaces an existing budget for the same scope and month.
          </p>
          <button className="btn-primary w-full" disabled={saving}>
            {saving ? 'Saving…' : 'Save budget'}
          </button>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Delete budget?"
        message="This budget limit will be removed. Your actual transactions won't be affected."
        onConfirm={async () => {
          if (confirmDelete) {
            await deleteBudget(confirmDelete.id);
            setToast('Budget deleted');
          }
          setConfirmDelete(null);
        }}
        onCancel={() => setConfirmDelete(null)}
      />

      <Toast message={toast} onClose={() => setToast('')} />
    </>
  );
}
