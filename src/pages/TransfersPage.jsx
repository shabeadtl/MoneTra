import { useState } from 'react';
import { ArrowLeftRight, Pencil, Plus, Trash2 } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useDataStore } from '../stores/dataStore';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import ConfirmDialog from '../components/ConfirmDialog';
import Toast from '../components/Toast';
import { money, messageFrom, prettyDate } from '../lib/utils';

const blankTransfer = { source_account_id: '', destination_account_id: '', amount: '', date: new Date().toISOString().slice(0, 10), description: '' };

export default function TransfersPage() {
  const user = useAuthStore((s) => s.user);
  const currency = useAuthStore((s) => s.profile?.currency || 'INR');
  const { accounts, transfers, addTransfer, updateTransfer, deleteTransfer } = useDataStore();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blankTransfer);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [toast, setToast] = useState('');

  const activeAccounts = accounts.filter((a) => !a.is_archived);

  const openCreate = () => { setForm(blankTransfer); setEditing(null); setError(''); setModalOpen(true); };
  const openEdit = (t) => {
    setForm({
      source_account_id: t.source_account_id,
      destination_account_id: t.destination_account_id,
      amount: String(t.amount),
      date: t.date,
      description: t.description || ''
    });
    setEditing(t);
    setError('');
    setModalOpen(true);
  };

  async function saveTransfer(e) {
    e.preventDefault();
    setBusy(true); setError('');
    const payload = {
      p_user_id: user.id,
      p_source_account_id: form.source_account_id,
      p_destination_account_id: form.destination_account_id,
      p_amount: Number(form.amount),
      p_date: form.date,
      p_description: form.description?.trim() || null,
    };
    try {
      if (editing) {
        await updateTransfer(editing.id, payload);
        setToast('Transfer updated');
      } else {
        await addTransfer(payload);
        setToast('Transfer completed');
      }
      setModalOpen(false);
    } catch (err) { setError(messageFrom(err)); } finally { setBusy(false); }
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black">Transfers</h1>
          <p className="mt-1 text-slate-500">Money moved between your own accounts.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" onClick={openCreate} disabled={activeAccounts.length < 2}>
            <Plus size={17} /> New transfer
          </button>
        </div>
      </div>

      {activeAccounts.length < 2 && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800/30 dark:bg-amber-950/40 dark:text-amber-200">
          You need at least two active accounts to make a transfer. Go to Accounts to add more.
        </div>
      )}

      {transfers.length === 0 ? (
        <section className="card">
          <EmptyState
            icon={ArrowLeftRight}
            title="No transfers yet"
            message="Moving money between your wallet and bank account? Track it here without affecting your income or expenses."
            action={<button className="btn-primary" onClick={openCreate} disabled={activeAccounts.length < 2}><Plus size={17} /> New transfer</button>}
          />
        </section>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900/50">
                <tr>
                  <th className="p-4 font-semibold">Date</th>
                  <th className="p-4 font-semibold">From</th>
                  <th className="p-4 font-semibold">To</th>
                  <th className="p-4 font-semibold text-right">Amount</th>
                  <th className="p-4 font-semibold">Description</th>
                  <th className="p-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {transfers.map((t) => {
                  const src = accounts.find(a => a.id === t.source_account_id);
                  const dst = accounts.find(a => a.id === t.destination_account_id);
                  return (
                    <tr key={t.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/20">
                      <td className="p-4 whitespace-nowrap text-slate-600 dark:text-slate-400">{prettyDate(t.date)}</td>
                      <td className="p-4 font-medium">{src?.name || 'Unknown'}</td>
                      <td className="p-4 font-medium">{dst?.name || 'Unknown'}</td>
                      <td className="p-4 text-right font-bold text-slate-700 dark:text-slate-200">{money(t.amount, currency)}</td>
                      <td className="p-4 text-slate-500 truncate max-w-[200px]">{t.description || '-'}</td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2 opacity-0 transition group-hover:opacity-100">
                          <button className="rounded p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200" onClick={() => openEdit(t)}>
                            <Pencil size={15} />
                          </button>
                          <button className="rounded p-1.5 text-slate-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30" onClick={() => setConfirmDelete(t)}>
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setError(''); }} title={editing ? "Edit transfer" : "Transfer money"}>
        <form className="space-y-4" onSubmit={saveTransfer}>
          {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
          <div>
            <label className="label">From</label>
            <select className="field" required value={form.source_account_id} onChange={(e) => setForm({ ...form, source_account_id: e.target.value })}>
              <option value="">Choose source account</option>
              {activeAccounts.map((a) => <option value={a.id} key={a.id}>{a.name} ({money(a.balance, a.currency || currency)})</option>)}
            </select>
          </div>
          <div>
            <label className="label">To</label>
            <select className="field" required value={form.destination_account_id} onChange={(e) => setForm({ ...form, destination_account_id: e.target.value })}>
              <option value="">Choose destination account</option>
              {activeAccounts.filter((a) => a.id !== form.source_account_id).map((a) => <option value={a.id} key={a.id}>{a.name} ({money(a.balance, a.currency || currency)})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Amount</label><input className="field" type="number" min="0.01" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="500" /></div>
            <div><label className="label">Date</label><input className="field" type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
          </div>
          <div><label className="label">Description</label><input className="field" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Lunch money, rent share…" /></div>
          
          <button className="btn-primary w-full" disabled={busy || !form.source_account_id || !form.destination_account_id || form.source_account_id === form.destination_account_id}>
            {busy ? 'Saving…' : editing ? 'Save changes' : 'Transfer'}
          </button>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Delete transfer?"
        message="This transfer will be deleted, and your account balances will be restored automatically."
        onConfirm={async () => {
          if (confirmDelete) {
            try {
              await deleteTransfer(confirmDelete.id);
              setToast('Transfer deleted');
            } catch (err) {
              alert(messageFrom(err));
            }
          }
          setConfirmDelete(null);
        }}
        onCancel={() => setConfirmDelete(null)}
      />

      <Toast message={toast} onClose={() => setToast('')} />
    </>
  );
}
