import { useMemo, useState } from 'react';
import { Gem, HandCoins, Pencil, Plus, Scale, Trash2, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useDataStore } from '../stores/dataStore';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import EntityIcon from '../components/EntityIcon';
import { money, messageFrom, prettyDate } from '../lib/utils';
import { ASSET_TYPES, LIABILITY_TYPES, metaOf } from '../lib/constants';
import ConfirmDialog from '../components/ConfirmDialog';
import Toast from '../components/Toast';

const blankAsset = { name: '', asset_type: 'GOLD', purchase_price: '', quantity: '1', purchase_date: '', current_value: '', notes: '' };
const blankLiability = { name: '', liability_type: 'LOAN', amount: '', interest_rate: '', start_date: '', end_date: '', monthly_payment: '', remaining_balance: '', notes: '' };

function TypeBadge({ map, type }) {
  const m = metaOf(map, type);
  return <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700/60 dark:bg-slate-800/80 dark:text-slate-200"><i className="h-1.5 w-1.5 rounded-full" style={{ background: m.color }} />{m.label}</span>;
}

export default function NetWorthPage() {
  const user = useAuthStore((s) => s.user);
  const currency = useAuthStore((s) => s.profile?.currency || 'INR');
  const { accounts, assets, liabilities, addAsset, updateAsset, deleteAsset, addLiability, updateLiability, deleteLiability } = useDataStore();

  const [assetModal, setAssetModal] = useState(null);
  const [assetForm, setAssetForm] = useState(blankAsset);
  const [liabModal, setLiabModal] = useState(null);
  const [liabForm, setLiabForm] = useState(blankLiability);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmAsset, setConfirmAsset] = useState(null);
  const [confirmLiability, setConfirmLiability] = useState(null);
  const [toast, setToast] = useState('');

  const totals = useMemo(() => {
    const cash = accounts.filter((a) => !a.is_archived).reduce((s, a) => s + Number(a.balance || 0), 0);
    const assetValue = assets.reduce((s, a) => s + Number(a.current_value || a.purchase_price || 0), 0);
    const liabilityValue = liabilities.reduce((s, l) => s + Number(l.remaining_balance || l.amount || 0), 0);
    return { cash, assetValue, liabilityValue, netWorth: cash + assetValue - liabilityValue };
  }, [accounts, assets, liabilities]);

  const assetGain = (a) => {
    const cost = Number(a.purchase_price || 0) * Number(a.quantity || 1);
    const current = Number(a.current_value || 0);
    return { cost, pct: cost ? ((current - cost) / cost) * 100 : 0 };
  };

  const openAsset = (a) => {
    setAssetForm(a ? { ...blankAsset, ...a, purchase_price: String(a.purchase_price ?? ''), quantity: String(a.quantity ?? '1'), current_value: String(a.current_value ?? '') } : blankAsset);
    setAssetModal({ editing: a || null }); setError('');
  };
  const openLiability = (l) => {
    setLiabForm(l ? { ...blankLiability, ...l, amount: String(l.amount ?? ''), interest_rate: String(l.interest_rate ?? ''), monthly_payment: String(l.monthly_payment ?? ''), remaining_balance: String(l.remaining_balance ?? '') } : blankLiability);
    setLiabModal({ editing: l || null }); setError('');
  };

  async function saveAsset(e) {
    e.preventDefault(); setBusy(true); setError('');
    const payload = {
      user_id: user.id,
      name: assetForm.name.trim(),
      asset_type: assetForm.asset_type,
      purchase_price: Number(assetForm.purchase_price || 0),
      quantity: Number(assetForm.quantity || 1),
      purchase_date: assetForm.purchase_date || null,
      current_value: Number(assetForm.current_value || assetForm.purchase_price || 0),
      notes: assetForm.notes?.trim() || null,
    };
    try {
      if (assetModal.editing) {
        await updateAsset(assetModal.editing.id, payload);
        setToast('Asset updated');
      } else {
        await addAsset(payload);
        setToast('Asset added');
      }
      setAssetModal(null);
    } catch (err) { setError(messageFrom(err)); } finally { setBusy(false); }
  }

  async function saveLiability(e) {
    e.preventDefault(); setBusy(true); setError('');
    const payload = {
      user_id: user.id,
      name: liabForm.name.trim(),
      liability_type: liabForm.liability_type,
      amount: Number(liabForm.amount || 0),
      interest_rate: Number(liabForm.interest_rate || 0),
      start_date: liabForm.start_date || null,
      end_date: liabForm.end_date || null,
      monthly_payment: Number(liabForm.monthly_payment || 0),
      remaining_balance: Number(liabForm.remaining_balance || liabForm.amount || 0),
      notes: liabForm.notes?.trim() || null,
    };
    try {
      if (liabModal.editing) {
        await updateLiability(liabModal.editing.id, payload);
        setToast('Liability updated');
      } else {
        await addLiability(payload);
        setToast('Liability added');
      }
      setLiabModal(null);
    } catch (err) { setError(messageFrom(err)); } finally { setBusy(false); }
  }

  return (
    <>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black">Net Worth</h1>
          <p className="mt-1 text-slate-500">Everything you own minus everything you owe.</p>
        </div>
      </div>

      {/* Net worth hero */}
      <section className="card mb-6 overflow-hidden bg-gradient-to-br from-brand-700 to-teal-800 !border-0 text-white">
        <div className="p-6">
          <p className="flex items-center gap-2 text-sm font-medium text-brand-100"><Scale size={16} /> Net worth</p>
          <p className="mt-2 text-4xl font-black tracking-tight">{money(totals.netWorth, currency)}</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl bg-white/10 p-4 backdrop-blur-sm">
              <p className="flex items-center gap-1.5 text-xs font-medium text-teal-100"><Wallet size={14} /> In accounts</p>
              <p className="mt-1 text-xl font-bold">{money(totals.cash, currency)}</p>
            </div>
            <div className="rounded-xl bg-white/10 p-4 backdrop-blur-sm">
              <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-100"><TrendingUp size={14} /> Total assets</p>
              <p className="mt-1 text-xl font-bold">{money(totals.assetValue, currency)}</p>
            </div>
            <div className="rounded-xl bg-white/10 p-4 backdrop-blur-sm">
              <p className="flex items-center gap-1.5 text-xs font-medium text-red-100"><TrendingDown size={14} /> Total liabilities</p>
              <p className="mt-1 text-xl font-bold">{money(totals.liabilityValue, currency)}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Assets */}
      <section className="mb-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-bold"><Gem size={18} className="text-amber-500" /> Assets</h2>
          <button className="btn-primary" onClick={() => openAsset(null)}><Plus size={17} /> Add asset</button>
        </div>

        {assets.length === 0 ? (
          <section className="card">
            <EmptyState icon={Gem} title="No assets tracked" message="Gold, stocks, crypto, fixed deposits — add them to see your true wealth." />
          </section>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {assets.map((a) => {
              const { cost, pct } = assetGain(a);
              const gain = Number(a.current_value) >= cost;
              return (
                <article key={a.id} className="card group !p-5 transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white" style={{ background: metaOf(ASSET_TYPES, a.asset_type).color }}>
                        <EntityIcon name={metaOf(ASSET_TYPES, a.asset_type).icon} size={22} />
                      </span>
                      <div className="min-w-0">
                        <h3 className="truncate font-bold">{a.name}</h3>
                        <TypeBadge map={ASSET_TYPES} type={a.asset_type} />
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1 opacity-0 transition group-hover:opacity-100">
                      <button className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-700 dark:hover:bg-slate-800" onClick={() => openAsset(a)} title="Edit"><Pencil size={15} /></button>
                      <button className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40" onClick={() => setConfirmAsset(a)} title="Delete"><Trash2 size={15} /></button>
                    </div>
                  </div>
                  <p className="mt-4 text-2xl font-black tracking-tight">{money(a.current_value, currency)}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span>Bought {money(cost, currency)}{Number(a.quantity) !== 1 ? ` × ${a.quantity}` : ''}</span>
                    {a.purchase_date && <span>· {prettyDate(a.purchase_date)}</span>}
                    <span className={`font-bold ${gain ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                      {gain ? '+' : ''}{pct.toFixed(1)}%
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Liabilities */}
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-bold"><HandCoins size={18} className="text-red-500" /> Liabilities</h2>
          <button className="btn-primary" onClick={() => openLiability(null)}><Plus size={17} /> Add liability</button>
        </div>

        {liabilities.length === 0 ? (
          <section className="card">
            <EmptyState icon={HandCoins} title="No liabilities" message="Loans, credit card balances and EMIs belong here — knowing them is the first step to clearing them." />
          </section>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {liabilities.map((l) => (
              <article key={l.id} className="card group !p-5 transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white" style={{ background: metaOf(LIABILITY_TYPES, l.liability_type).color }}>
                      <EntityIcon name={metaOf(LIABILITY_TYPES, l.liability_type).icon} size={22} />
                    </span>
                    <div className="min-w-0">
                      <h3 className="truncate font-bold">{l.name}</h3>
                      <TypeBadge map={LIABILITY_TYPES} type={l.liability_type} />
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1 opacity-0 transition group-hover:opacity-100">
                    <button className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-700 dark:hover:bg-slate-800" onClick={() => openLiability(l)} title="Edit"><Pencil size={15} /></button>
                    <button className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40" onClick={() => setConfirmLiability(l)} title="Delete"><Trash2 size={15} /></button>
                  </div>
                </div>
                <p className="mt-4 text-2xl font-black tracking-tight text-red-600 dark:text-red-400">{money(l.remaining_balance, currency)}</p>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span>Owed {money(l.amount, currency)}</span>
                  {Number(l.interest_rate) > 0 && <span>· {l.interest_rate}% p.a.</span>}
                  {Number(l.monthly_payment) > 0 && <span>· {money(l.monthly_payment, currency)}/mo</span>}
                  {l.end_date && <span>· ends {prettyDate(l.end_date)}</span>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Asset modal */}
      <Modal open={Boolean(assetModal)} onClose={() => setAssetModal(null)} title={assetModal?.editing ? 'Edit asset' : 'Add asset'}>
        <form className="space-y-4" onSubmit={saveAsset}>
          {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
          <div><label className="label">Name</label><input className="field" required maxLength={80} value={assetForm.name} onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })} placeholder="Gold necklace, AAPL, BTC…" /></div>
          <div>
            <label className="label">Type</label>
            <select className="field" value={assetForm.asset_type} onChange={(e) => setAssetForm({ ...assetForm, asset_type: e.target.value })}>
              {Object.entries(ASSET_TYPES).map(([k, v]) => <option value={k} key={k}>{v.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Purchase price</label><input className="field" type="number" min="0" step="0.01" value={assetForm.purchase_price} onChange={(e) => setAssetForm({ ...assetForm, purchase_price: e.target.value })} placeholder="0" /></div>
            <div><label className="label">Quantity</label><input className="field" type="number" min="0" step="any" value={assetForm.quantity} onChange={(e) => setAssetForm({ ...assetForm, quantity: e.target.value })} placeholder="1" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Purchase date</label><input className="field" type="date" value={assetForm.purchase_date || ''} onChange={(e) => setAssetForm({ ...assetForm, purchase_date: e.target.value })} /></div>
            <div><label className="label">Current value</label><input className="field" type="number" min="0" step="0.01" value={assetForm.current_value} onChange={(e) => setAssetForm({ ...assetForm, current_value: e.target.value })} placeholder="Falls back to purchase price" /></div>
          </div>
          <div><label className="label">Notes</label><input className="field" value={assetForm.notes || ''} onChange={(e) => setAssetForm({ ...assetForm, notes: e.target.value })} placeholder="Optional" /></div>
          <button className="btn-primary w-full" disabled={busy}>{busy ? 'Saving…' : assetModal?.editing ? 'Save changes' : 'Add asset'}</button>
        </form>
      </Modal>

      {/* Liability modal */}
      <Modal open={Boolean(liabModal)} onClose={() => setLiabModal(null)} title={liabModal?.editing ? 'Edit liability' : 'Add liability'}>
        <form className="space-y-4" onSubmit={saveLiability}>
          {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
          <div><label className="label">Name</label><input className="field" required maxLength={80} value={liabForm.name} onChange={(e) => setLiabForm({ ...liabForm, name: e.target.value })} placeholder="Car loan, credit card, home EMI…" /></div>
          <div>
            <label className="label">Type</label>
            <select className="field" value={liabForm.liability_type} onChange={(e) => setLiabForm({ ...liabForm, liability_type: e.target.value })}>
              {Object.entries(LIABILITY_TYPES).map(([k, v]) => <option value={k} key={k}>{v.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Total amount</label><input className="field" type="number" min="0" step="0.01" value={liabForm.amount} onChange={(e) => setLiabForm({ ...liabForm, amount: e.target.value })} placeholder="0" /></div>
            <div><label className="label">Interest rate (% p.a.)</label><input className="field" type="number" min="0" step="0.01" value={liabForm.interest_rate} onChange={(e) => setLiabForm({ ...liabForm, interest_rate: e.target.value })} placeholder="0" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Start date</label><input className="field" type="date" value={liabForm.start_date || ''} onChange={(e) => setLiabForm({ ...liabForm, start_date: e.target.value })} /></div>
            <div><label className="label">End date</label><input className="field" type="date" value={liabForm.end_date || ''} onChange={(e) => setLiabForm({ ...liabForm, end_date: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Monthly payment</label><input className="field" type="number" min="0" step="0.01" value={liabForm.monthly_payment} onChange={(e) => setLiabForm({ ...liabForm, monthly_payment: e.target.value })} placeholder="0" /></div>
            <div><label className="label">Remaining balance</label><input className="field" type="number" min="0" step="0.01" value={liabForm.remaining_balance} onChange={(e) => setLiabForm({ ...liabForm, remaining_balance: e.target.value })} placeholder="Defaults to total" /></div>
          </div>
          <button className="btn-primary w-full" disabled={busy}>{busy ? 'Saving…' : liabModal?.editing ? 'Save changes' : 'Add liability'}</button>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmAsset)}
        title="Delete asset?"
        message={`"${confirmAsset?.name}" will be permanently deleted. This cannot be undone.`}
        onConfirm={async () => {
          if (confirmAsset) {
            await deleteAsset(confirmAsset.id);
            setToast(`"${confirmAsset.name}" deleted`);
          }
          setConfirmAsset(null);
        }}
        onCancel={() => setConfirmAsset(null)}
      />

      <ConfirmDialog
        open={Boolean(confirmLiability)}
        title="Delete liability?"
        message={`"${confirmLiability?.name}" will be permanently deleted. This cannot be undone.`}
        onConfirm={async () => {
          if (confirmLiability) {
            await deleteLiability(confirmLiability.id);
            setToast(`"${confirmLiability.name}" deleted`);
          }
          setConfirmLiability(null);
        }}
        onCancel={() => setConfirmLiability(null)}
      />

      <Toast message={toast} onClose={() => setToast('')} />
    </>
  );
}
