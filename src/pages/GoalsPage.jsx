import { useState } from 'react';
import { CalendarClock, Pencil, Plus, Target, Trash2, Trophy } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useDataStore } from '../stores/dataStore';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import EntityIcon from '../components/EntityIcon';
import { money, messageFrom, prettyDate } from '../lib/utils';
import { GOAL_ICONS, GOAL_PRIORITIES, metaOf } from '../lib/constants';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import ConfirmDialog from '../components/ConfirmDialog';
import Toast from '../components/Toast';

const blank = {
  name: '', target_amount: '', saved_amount: '', deadline: '', priority: 'MEDIUM',
  icon: 'Target', color: '#0D9488',
};

export default function GoalsPage() {
  const user = useAuthStore((s) => s.user);
  const currency = useAuthStore((s) => s.profile?.currency || 'INR');
  const { goals, addGoal, updateGoal, deleteGoal, saveGoalContribution } = useDataStore();

  const [modal, setModal] = useState(null); // { goal } | null
  const [form, setForm] = useState(blank);
  const [contrib, setContrib] = useState({}); // goalId -> amount string
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [toast, setToast] = useState('');

  const totalSaved = goals.reduce((s, g) => s + Number(g.saved_amount || 0), 0);
  const totalTarget = goals.reduce((s, g) => s + Number(g.target_amount || 0), 0);
  const achieved = goals.filter((g) => Number(g.saved_amount) >= Number(g.target_amount)).length;

  const openCreate = () => { setForm(blank); setModal({ goal: null }); setError(''); };
  const openEdit = (g) => {
    setForm({ ...blank, ...g, target_amount: String(g.target_amount), saved_amount: String(g.saved_amount) });
    setModal({ goal: g }); setError('');
  };

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    const payload = {
      user_id: user.id,
      name: form.name.trim(),
      target_amount: Number(form.target_amount),
      saved_amount: Number(form.saved_amount || 0),
      deadline: form.deadline || null,
      priority: form.priority,
      icon: form.icon,
      color: form.color.toUpperCase(),
    };
    try {
      if (modal.goal) {
        await updateGoal(modal.goal.id, payload);
        setToast('Goal updated');
      } else {
        await addGoal(payload);
        setToast('Goal created');
      }
      setModal(null);
    } catch (err) { setError(messageFrom(err)); } finally { setBusy(false); }
  }

  async function contribute(g) {
    const amount = Number(contrib[g.id]);
    if (!amount || amount <= 0) return;
    await saveGoalContribution(g.id, amount);
    setContrib((s) => ({ ...s, [g.id]: '' }));
    setToast('Contribution added');
  }

  return (
    <>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black">Goals</h1>
          <p className="mt-1 text-slate-500">Savings targets that keep you moving — bike, house, emergency fund, anything.</p>
        </div>
        <button className="btn-primary shadow-[0_4px_20px_-4px_rgba(15,118,110,0.4)] transition hover:scale-[1.02] active:scale-95" onClick={openCreate}>
          <Plus size={17} /> New goal
        </button>
      </div>

      {/* Progress summary */}
      {goals.length > 0 && (
        <section className="card mb-6 overflow-hidden !p-0">
          <div className="p-6 pb-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-bold">Overall progress</h2>
                <p className="text-sm text-slate-500">{money(totalSaved, currency)} saved of {money(totalTarget, currency)}</p>
              </div>
              <p className="flex items-center gap-1.5 text-sm font-semibold text-brand-700 dark:text-brand-300"><Trophy size={16} /> {achieved} achieved</p>
            </div>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div className="h-full rounded-full bg-gradient-to-r from-brand-600 to-emerald-500 transition-all duration-500" style={{ width: `${Math.min(100, totalTarget ? (totalSaved / totalTarget) * 100 : 0)}%` }} />
            </div>
          </div>
        </section>
      )}

      {/* Goal cards */}
      {goals.length === 0 ? (
        <section className="card">
          <EmptyState
            icon={Target}
            title="No goals yet"
            message="Set a target — an emergency fund, a motorcycle, a house down payment — and track your progress."
            action={<button className="btn-primary" onClick={openCreate}><Plus size={17} /> New goal</button>}
          />
        </section>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {goals.map((g) => {
            const pct = Math.min(100, (Number(g.saved_amount) / Number(g.target_amount)) * 100);
            const done = pct >= 100;
            const daysLeft = g.deadline ? differenceInCalendarDays(parseISO(g.deadline), new Date()) : null;
            const priority = metaOf(GOAL_PRIORITIES, g.priority);
            return (
              <article key={g.id} className="card group relative overflow-hidden !p-5 transition hover:-translate-y-0.5 hover:shadow-md" style={{ borderTop: `3px solid ${g.color}` }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white shadow-sm" style={{ background: g.color }}>
                      <EntityIcon name={g.icon || 'Target'} size={22} />
                    </span>
                    <div className="min-w-0">
                      <h2 className="truncate font-bold">{g.name}</h2>
                      <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${priority.badge}`}>{priority.label}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1 opacity-0 transition group-hover:opacity-100">
                    <button className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-brand-700 dark:hover:bg-slate-800" onClick={() => openEdit(g)} title="Edit"><Pencil size={15} /></button>
                    <button className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40" onClick={() => setConfirmDelete(g)} title="Delete"><Trash2 size={15} /></button>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex items-end justify-between text-sm">
                    <p className="text-lg font-black">{money(g.saved_amount, currency)}</p>
                    <p className="text-slate-500">of {money(g.target_amount, currency)}</p>
                  </div>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className={`h-full rounded-full transition-all duration-500 ${done ? 'bg-emerald-500' : 'bg-brand-600'}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                    <span className="font-bold">{Math.round(pct)}%</span>
                    {g.deadline ? (
                      <span className={`flex items-center gap-1 ${daysLeft < 0 ? 'text-slate-400' : daysLeft < 30 ? 'text-amber-600' : ''}`}>
                        <CalendarClock size={13} /> {daysLeft < 0 ? 'Past deadline' : `${daysLeft} days left`} · {prettyDate(g.deadline)}
                      </span>
                    ) : <span className="text-slate-400">No deadline</span>}
                  </div>
                </div>

                {/* Quick contribute */}
                <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); contribute(g); }}>
                  <input
                    className="field !py-2 text-sm"
                    type="number" min="0.01" step="0.01"
                    value={contrib[g.id] || ''}
                    onChange={(e) => setContrib((s) => ({ ...s, [g.id]: e.target.value }))}
                    placeholder={done ? 'Add to savings…' : 'Add amount…'}
                  />
                  <button type="submit" className="btn-primary shrink-0 !px-4 !py-2 text-sm">Add</button>
                </form>
              </article>
            );
          })}
        </div>
      )}

      {/* Goal modal */}
      <Modal open={Boolean(modal)} onClose={() => setModal(null)} title={modal?.goal ? 'Edit goal' : 'New savings goal'}>
        <form className="space-y-4" onSubmit={submit}>
          {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
          <div><label className="label">Goal name</label><input className="field" required maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Emergency fund, motorcycle…" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Target amount</label><input className="field" type="number" min="1" step="0.01" required value={form.target_amount} onChange={(e) => setForm({ ...form, target_amount: e.target.value })} placeholder="100000" /></div>
            <div><label className="label">Already saved</label><input className="field" type="number" min="0" step="0.01" value={form.saved_amount} onChange={(e) => setForm({ ...form, saved_amount: e.target.value })} placeholder="0" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Deadline</label><input className="field" type="date" value={form.deadline || ''} onChange={(e) => setForm({ ...form, deadline: e.target.value })} /></div>
            <div>
              <label className="label">Priority</label>
              <select className="field" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                {Object.entries(GOAL_PRIORITIES).map(([k, v]) => <option value={k} key={k}>{v.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Icon</label>
            <div className="flex flex-wrap gap-2">
              {GOAL_ICONS.map((icon) => (
                <button type="button" key={icon} onClick={() => setForm({ ...form, icon })}
                  className={`grid h-10 w-10 place-items-center rounded-xl border transition ${form.icon === icon ? 'border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300' : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'}`}>
                  <EntityIcon name={icon} size={19} />
                </button>
              ))}
              <input className="h-10 w-12 cursor-pointer rounded-xl border p-1 dark:border-slate-700" type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value.toUpperCase() })} title="Goal color" />
            </div>
          </div>
          <button className="btn-primary w-full" disabled={busy}>{busy ? 'Saving…' : modal?.goal ? 'Save changes' : 'Create goal'}</button>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Delete goal?"
        message={`"${confirmDelete?.name}" will be permanently deleted. This cannot be undone.`}
        onConfirm={async () => {
          if (confirmDelete) {
            await deleteGoal(confirmDelete.id);
            setToast(`"${confirmDelete.name}" deleted`);
          }
          setConfirmDelete(null);
        }}
        onCancel={() => setConfirmDelete(null)}
      />

      <Toast message={toast} onClose={() => setToast('')} />
    </>
  );
}
