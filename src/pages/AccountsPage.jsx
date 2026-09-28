import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftRight, Archive, ArchiveRestore, Coins, Pencil, Plus, Wallet } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useDataStore } from '../stores/dataStore';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import EntityIcon from '../components/EntityIcon';
import { money, messageFrom, prettyDate } from '../lib/utils';
import { ACCOUNT_TYPES, metaOf } from '../lib/constants';
import ConfirmDialog from '../components/ConfirmDialog';
import Toast from '../components/Toast';

const blankAccount = {
  name: '', account_type: 'CASH', institution_name: '', account_number: '',
  currency: 'INR', opening_balance: '', opening_date: new Date().toISOString().slice(0, 10),
  color: '#0D9488', icon: 'Wallet',
};

const blankTransfer = { source_account_id: '', destination_account_id: '', amount: '', date: new Date().toISOString().slice(0, 10), description: '' };

export default function AccountsPage() {
  const user = useAuthStore((s) => s.user);
  const currency = useAuthStore((s) => s.profile?.currency || 'INR');
  const { accounts, addAccount, updateAccount, archiveAccount, addTransfer } = useDataStore();

  const [accountModal, setAccountModal] = useState(null); // { editing } | null
  const [form, setForm] = useState(blankAccount);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transfer, setTransfer] = useState(blankTransfer);
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(null);
  const [toast, setToast] = useState('');

  const active = accounts.filter((a) => !a.is_archived);
  const archived = accounts.filter((a) => a.is_archived);
  const totalBalance = active.reduce((s, a) => s + Number(a.balance || 0), 0);

  const openCreate = () => { setForm(blankAccount); setAccountModal({ editing: null }); setError(''); };
  const openEdit = (acc) => {
    setForm({ ...blankAccount, ...acc, opening_balance: String(acc.opening_balance ?? '') });
    setAccountModal({ editing: acc });
    setError('');
  };

  async function saveAccount(e) {
    e.preventDefault();
    setBusy(true); setError('');
    const payload = {
      user_id: user.id,
      name: form.name.trim(),
      account_type: form.account_type,
      institution_name: form.institution_name?.trim() || null,
      account_number: form.account_number?.trim() || null,
      currency: form.currency,
      opening_balance: Number(form.opening_balance || 0),
      opening_date: form.opening_date,
      color: form.color.toUpperCase(),
      icon: metaOf(ACCOUNT_TYPES, form.account_type).icon,
    };
    try {
      if (accountModal.editing) {
        await updateAccount(accountModal.editing.id, payload);
        setToast('Account updated');
      } else {
        await addAccount(payload);
        setToast('Account created');
      }
      setAccountModal(null);
    } catch (err) { setError(messageFrom(err)); } finally { setBusy(false); }
  }

  async function saveTransfer(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await addTransfer({
        p_user_id: user.id,
        p_source_account_id: transfer.source_account_id,
        p_destination_account_id: transfer.destination_account_id,
        p_amount: Number(transfer.amount),
        p_date: transfer.date,
        p_description: transfer.description?.trim() || null,
      });
      setTransferOpen(false); setTransfer(blankTransfer);
      setToast('Transfer complete');
    } catch (err) { setError(messageFrom(err)); } finally { setBusy(false); }
  }

  const transferOptions = active;
  const accountIcon = (acc) => metaOf(ACCOUNT_TYPES, acc.account_type).icon;

  return (
    <>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black">Accounts</h1>
          <p className="mt-1 text-slate-500">Where your money lives — wallets, banks, cards and more.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={() => setTransferOpen(true)} disabled={active.length < 2}>
            <ArrowLeftRight size={17} /> Transfer
          </button>
          <button className="btn-primary shadow-[0_4px_20px_-4px_rgba(15,118,110,0.4)] transition hover:scale-[1.02] active:scale-95" onClick={openCreate}>
            <Plus size={17} /> Add account
          </button>
        </div>
      </div>

      {/* Summary strip */}
      <div className="mb-6 flex flex-wrap gap-3">
        <div className="card !flex-1 !flex-row !items-center gap-3 !p-4 min-w-52">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
            <Wallet size={22} />
          </span>
          <div>
            <p className="text-xs font-medium text-slate-500">Total balance</p>
            <p className="text-xl font-black tracking-tight">{money(totalBalance, currency)}</p>
          </div>
        </div>
        <div className="card !flex-1 !flex-row !items-center gap-3 !p-4 min-w-52">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <Coins size={22} />
          </span>
          <div>
            <p className="text-xs font-medium text-slate-500">Active accounts</p>
            <p className="text-xl font-black tracking-tight">{active.length}</p>
          </div>
        </div>
      </div>

      {/* Account cards */}
      {active.length === 0 ? (
        <section className="card">
          <EmptyState
            icon={Wallet}
            title="No accounts yet"
            message="Create your Cash wallet, bank accounts and cards to start tracking where your money is stored."
            action={<button className="btn-primary" onClick={openCreate}><Plus size={17} /> Add account</button>}
          />
        </section>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {active.map((acc) => (
            <Link to={`/transactions?account=${acc.id}`} key={acc.id} className="card group relative overflow-hidden !p-5 transition hover:-translate-y-0.5 hover:shadow-md block" style={{ borderTop: `3px solid ${acc.color}` }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white shadow-sm" style={{ background: acc.color }}>
                    <EntityIcon name={accountIcon(acc)} size={22} />
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate font-bold">{acc.name}</h2>
                    <p className="text-xs text-slate-500">{metaOf(ACCOUNT_TYPES, acc.account_type).label}{acc.institution_name ? ` · ${acc.institution_name}` : ''}</p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1 opacity-0 transition group-hover:opacity-100">
                  <button className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-brand-700 dark:hover:bg-slate-800" onClick={(e) => { e.preventDefault(); openEdit(acc); }} title="Edit"><Pencil size={15} /></button>
                  <button className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40" onClick={(e) => { e.preventDefault(); setConfirmArchive(acc); }} title="Archive"><Archive size={15} /></button>
                </div>
              </div>
              <p className="mt-5 text-2xl font-black tracking-tight">{money(acc.balance, acc.currency || currency)}</p>
              <p className="mt-1 text-xs text-slate-500">
                Opening {money(acc.opening_balance, acc.currency || currency)} · {prettyDate(acc.opening_date)}
                {acc.account_number ? ` · ••${String(acc.account_number).slice(-4)}` : ''}
              </p>
            </Link>
          ))}
        </div>
      )}

      {/* Archived */}
      {archived.length > 0 && (
        <section className="mt-8">
          <button className="text-sm font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300" onClick={() => setShowArchived(!showArchived)}>
            {showArchived ? 'Hide' : 'Show'} archived ({archived.length})
          </button>
          {showArchived && (
            <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {archived.map((acc) => (
                <article key={acc.id} className="card !p-5 opacity-70">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="grid h-10 w-10 place-items-center rounded-xl text-white" style={{ background: acc.color }}>
                        <EntityIcon name={accountIcon(acc)} size={20} />
                      </span>
                      <div>
                        <h3 className="font-semibold line-through">{acc.name}</h3>
                        <p className="text-xs text-slate-500">{money(acc.balance, acc.currency || currency)}</p>
                      </div>
                    </div>
                    <button className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-brand-700 dark:hover:bg-slate-800" onClick={async () => { await updateAccount(acc.id, { is_archived: false }); setToast(`"${acc.name}" restored`); }} title="Restore">
                      <ArchiveRestore size={17} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Account modal */}
      <Modal open={Boolean(accountModal)} onClose={() => setAccountModal(null)} title={accountModal?.editing ? 'Edit account' : 'Add account'}>
        <form className="space-y-4" onSubmit={saveAccount}>
          {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
          <div><label className="label">Name</label><input className="field" required maxLength={60} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Cash wallet, SBI, HDFC…" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Type</label>
              <select className="field" value={form.account_type} onChange={(e) => setForm({ ...form, account_type: e.target.value, icon: metaOf(ACCOUNT_TYPES, e.target.value).icon })}>
                {Object.entries(ACCOUNT_TYPES).map(([k, v]) => <option value={k} key={k}>{v.label}</option>)}
              </select>
            </div>
            <div><label className="label">Currency</label>
              <select className="field" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                {['INR', 'USD', 'EUR', 'GBP'].map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Institution</label><input className="field" value={form.institution_name} onChange={(e) => setForm({ ...form, institution_name: e.target.value })} placeholder="Federal Bank" /></div>
            <div><label className="label">Account number</label><input className="field" value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })} placeholder="Optional" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Opening balance</label><input className="field" type="number" min="0" step="0.01" value={form.opening_balance} onChange={(e) => setForm({ ...form, opening_balance: e.target.value })} placeholder="0" /></div>
            <div><label className="label">Opening date</label><input className="field" type="date" value={form.opening_date} onChange={(e) => setForm({ ...form, opening_date: e.target.value })} /></div>
          </div>
          <div className="flex items-center justify-between rounded-xl border p-3 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <input className="h-9 w-12 cursor-pointer rounded-lg border p-1" type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value.toUpperCase() })} />
              <span className="text-sm text-slate-500">Card color</span>
            </div>
            <span className="grid h-10 w-10 place-items-center rounded-xl text-white" style={{ background: form.color.toUpperCase() }}>
              <EntityIcon name={metaOf(ACCOUNT_TYPES, form.account_type).icon} size={20} />
            </span>
          </div>
          <p className="text-sm text-slate-500">Current balance is calculated automatically from your opening balance plus income minus expenses.</p>
          <button className="btn-primary w-full" disabled={busy}>{busy ? 'Saving…' : accountModal?.editing ? 'Save changes' : 'Add account'}</button>
        </form>
      </Modal>

      {/* Transfer modal */}
      <Modal open={transferOpen} onClose={() => { setTransferOpen(false); setTransfer(blankTransfer); setError(''); }} title="Transfer between accounts">
        <form className="space-y-4" onSubmit={saveTransfer}>
          {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
          <div>
            <label className="label">From</label>
            <select className="field" required value={transfer.source_account_id} onChange={(e) => setTransfer({ ...transfer, source_account_id: e.target.value })}>
              <option value="">Choose source account</option>
              {transferOptions.map((a) => <option value={a.id} key={a.id}>{a.name} ({money(a.balance, a.currency || currency)})</option>)}
            </select>
          </div>
          <div>
            <label className="label">To</label>
            <select className="field" required value={transfer.destination_account_id} onChange={(e) => setTransfer({ ...transfer, destination_account_id: e.target.value })}>
              <option value="">Choose destination account</option>
              {transferOptions.filter((a) => a.id !== transfer.source_account_id).map((a) => <option value={a.id} key={a.id}>{a.name} ({money(a.balance, a.currency || currency)})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Amount</label><input className="field" type="number" min="0.01" step="0.01" required value={transfer.amount} onChange={(e) => setTransfer({ ...transfer, amount: e.target.value })} placeholder="500" /></div>
            <div><label className="label">Date</label><input className="field" type="date" required value={transfer.date} onChange={(e) => setTransfer({ ...transfer, date: e.target.value })} /></div>
          </div>
          <div><label className="label">Description</label><input className="field" value={transfer.description} onChange={(e) => setTransfer({ ...transfer, description: e.target.value })} placeholder="Lunch money, rent share…" /></div>
          <p className="text-sm text-slate-500">A transfer creates two entries — money out of the source and into the destination — so your balances stay in sync.</p>
          <button className="btn-primary w-full" disabled={busy || !transfer.source_account_id || !transfer.destination_account_id || transfer.source_account_id === transfer.destination_account_id}>
            {busy ? 'Moving…' : 'Transfer'}
          </button>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmArchive)}
        title="Archive account?"
        message={`"${confirmArchive?.name}" will be archived. It won't affect past transactions.`}
        onConfirm={async () => {
          if (confirmArchive) {
            await archiveAccount(confirmArchive.id);
            setToast(`"${confirmArchive.name}" archived`);
          }
          setConfirmArchive(null);
        }}
        onCancel={() => setConfirmArchive(null)}
      />

      <Toast message={toast} onClose={() => setToast('')} />
    </>
  );
}
