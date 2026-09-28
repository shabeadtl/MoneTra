import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useDataStore } from '../stores/dataStore';
import { messageFrom } from '../lib/utils';

const blank = {
  type: 'EXPENSE', title: '', amount: '', category_id: '', account_id: '',
  date: new Date().toISOString().slice(0, 10), notes: '', is_recurring: false,
};

export default function TransactionForm({ initial, onDone }) {
  const user = useAuthStore((s) => s.user);
  const { categories, accounts, addTransaction, updateTransaction, addCategory } = useDataStore();
  const [form, setForm] = useState(blank);
  const [custom, setCustom] = useState(false);
  const [cat, setCat] = useState({ name: '', icon: 'CircleDollarSign', color: '#14B8A6' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (initial) setForm({ ...blank, ...initial, amount: String(initial.amount) }); }, [initial]);
  const change = (e) => setForm((s) => ({ ...s, [e.target.name]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const availableAccounts = accounts.filter((a) => !a.is_archived);
  // Show categories that match the chosen type (old user categories have no type → show in both)
  const typeCategories = categories.filter((c) => !c.category_type || c.category_type === form.type);

  async function createCategory() {
    if (!cat.name.trim()) return;
    try {
      const made = await addCategory({ ...cat, name: cat.name.trim(), user_id: user.id, category_type: form.type });
      setForm((s) => ({ ...s, category_id: made.id })); setCustom(false);
    } catch (e) { setError(messageFrom(e)); }
  }

  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('');
    const payload = {
      user_id: user.id,
      type: form.type,
      title: form.title.trim(),
      amount: Number(form.amount),
      category_id: form.category_id,
      account_id: form.account_id || null,
      date: form.date,
      notes: form.notes?.trim() || null,
      is_recurring: Boolean(form.is_recurring),
    };
    try { initial ? await updateTransaction(initial.id, payload) : await addTransaction(payload); onDone?.(); }
    catch (err) { setError(messageFrom(err)); } finally { setBusy(false); }
  }

  return <form className="space-y-4" onSubmit={submit}>
    {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
    <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
      {['EXPENSE', 'INCOME'].map((type) => <button type="button" key={type} onClick={() => setForm((s) => ({ ...s, type }))} className={`rounded-lg py-2 text-sm font-semibold ${form.type === type ? 'bg-white shadow dark:bg-slate-700' : 'text-slate-500'}`}>{type === 'EXPENSE' ? 'Expense' : 'Income'}</button>)}
    </div>
    <div><label className="label">Title</label><input className="field" name="title" value={form.title} onChange={change} required maxLength={120} placeholder="Groceries, salary…" /></div>
    <div className="grid grid-cols-2 gap-3">
      <div><label className="label">Amount</label><input className="field" name="amount" value={form.amount} onChange={change} type="number" min="0.01" step="0.01" required /></div>
      <div><label className="label">Date</label><input className="field" name="date" value={form.date} onChange={change} type="date" required /></div>
    </div>
    <div>
      <label className="label">Account</label>
      <select className="field" name="account_id" value={form.account_id || ''} onChange={change}>
        <option value="">No account</option>
        {availableAccounts.map((a) => <option value={a.id} key={a.id}>{a.name}</option>)}
      </select>
      {availableAccounts.length === 0 && <p className="mt-1 text-xs text-amber-600">No accounts yet — create one on the Accounts page to track balances.</p>}
    </div>
    <div><label className="label">Category</label><div className="flex gap-2"><select className="field" name="category_id" value={form.category_id} onChange={change} required><option value="">Choose category</option>{typeCategories.map((c) => <option value={c.id} key={c.id}>{c.name}</option>)}</select><button type="button" className="btn-secondary shrink-0 px-3" onClick={() => setCustom(!custom)} aria-label="Create category"><Plus size={18} /></button></div></div>
    {custom && <div className="rounded-xl border bg-slate-50 p-3 dark:bg-slate-800/50"><p className="mb-2 text-sm font-semibold">New category</p><div className="flex gap-2"><input className="field" value={cat.name} onChange={(e) => setCat({ ...cat, name: e.target.value })} placeholder="Category name" maxLength={60} /><input className="h-10 w-14 rounded-lg border p-1" type="color" value={cat.color} onChange={(e) => setCat({ ...cat, color: e.target.value.toUpperCase() })} /><button type="button" className="btn-primary" onClick={createCategory}>Add</button></div></div>}
    <div><label className="label">Notes</label><textarea className="field min-h-20 resize-y" name="notes" value={form.notes || ''} onChange={change} placeholder="Optional details" /></div>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_recurring" checked={form.is_recurring} onChange={change} className="h-4 w-4 accent-brand-700" /> Recurring transaction</label>
    <button className="btn-primary w-full" disabled={busy}>{busy ? 'Saving…' : initial ? 'Save changes' : navigator.onLine ? 'Add transaction' : 'Save offline'}</button>
  </form>;
}
