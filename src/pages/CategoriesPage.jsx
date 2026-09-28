import { useState } from 'react';
import { Archive, ArchiveRestore, Folder, Pencil, Plus } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useDataStore } from '../stores/dataStore';
import Modal from '../components/Modal';
import EntityIcon from '../components/EntityIcon';
import { messageFrom } from '../lib/utils';
import { ICON_MAP } from '../lib/constants';
import ConfirmDialog from '../components/ConfirmDialog';
import Toast from '../components/Toast';

const blankCategory = { name: '', icon: 'Folder', color: '#64748B', category_type: 'EXPENSE' };

export default function CategoriesPage() {
  const user = useAuthStore((s) => s.user);
  const { categories, addCategory, updateCategory } = useDataStore();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blankCategory);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(null);
  const [toast, setToast] = useState('');

  // Group categories
  const userCategories = categories.filter((c) => c.user_id === user.id);
  const systemCategories = categories.filter((c) => c.user_id === null);

  const activeUser = userCategories.filter((c) => !c.is_archived);
  const archivedUser = userCategories.filter((c) => c.is_archived);

  const openCreate = () => { setForm(blankCategory); setEditing(null); setError(''); setModalOpen(true); };
  const openEdit = (c) => { setForm({ name: c.name, icon: c.icon, color: c.color, category_type: c.category_type }); setEditing(c); setError(''); setModalOpen(true); };

  async function saveCategory(e) {
    e.preventDefault();
    setBusy(true); setError('');
    const payload = {
      user_id: user.id,
      name: form.name.trim(),
      icon: form.icon,
      color: form.color.toUpperCase(),
      category_type: form.category_type,
    };
    try {
      if (editing) {
        await updateCategory(editing.id, payload);
        setToast('Category updated');
      } else {
        await addCategory(payload);
        setToast('Category created');
      }
      setModalOpen(false);
    } catch (err) { setError(messageFrom(err)); } finally { setBusy(false); }
  }

  function CategoryCard({ c, isSystem }) {
    return (
      <article className={`card flex items-center justify-between !p-4 transition hover:shadow-md ${c.is_archived ? 'opacity-60' : ''}`} style={{ borderLeft: `4px solid ${c.color}` }}>
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl text-white" style={{ background: c.color }}>
            <EntityIcon name={c.icon} size={20} />
          </span>
          <div>
            <h3 className={`font-semibold ${c.is_archived ? 'line-through' : ''}`}>{c.name}</h3>
            <p className="text-xs text-slate-500 uppercase tracking-wider">{c.category_type}</p>
          </div>
        </div>
        {!isSystem && (
          <div className="flex shrink-0 gap-1 opacity-0 transition group-hover:opacity-100 hover:opacity-100 sm:opacity-100">
            {c.is_archived ? (
              <button className="rounded p-2 text-slate-400 hover:bg-slate-100 hover:text-brand-700 dark:hover:bg-slate-800" onClick={async () => { await updateCategory(c.id, { is_archived: false }); setToast(`"${c.name}" restored`); }} title="Restore"><ArchiveRestore size={16} /></button>
            ) : (
              <>
                <button className="rounded p-2 text-slate-400 hover:bg-slate-100 hover:text-brand-700 dark:hover:bg-slate-800" onClick={() => openEdit(c)} title="Edit"><Pencil size={16} /></button>
                <button className="rounded p-2 text-slate-400 hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-950/40" onClick={() => setConfirmArchive(c)} title="Archive"><Archive size={16} /></button>
              </>
            )}
          </div>
        )}
      </article>
    );
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black">Categories</h1>
          <p className="mt-1 text-slate-500">Organize your income and expenses.</p>
        </div>
        <button className="btn-primary" onClick={openCreate}>
          <Plus size={17} /> New category
        </button>
      </div>

      <div className="space-y-8">
        <section>
          <h2 className="mb-4 text-lg font-bold text-slate-700 dark:text-slate-300">Your Custom Categories</h2>
          {userCategories.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center dark:border-slate-800 dark:bg-slate-900/50">
              <Folder className="mx-auto mb-3 text-slate-400" size={32} />
              <p className="text-sm text-slate-500">You haven&apos;t created any custom categories yet.</p>
            </div>
          ) : (
            <>
              {activeUser.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {activeUser.map(c => <CategoryCard key={c.id} c={c} />)}
                </div>
              )}
              {archivedUser.length > 0 && (
                <div className="mt-6">
                  <h3 className="mb-3 text-sm font-semibold text-slate-500">Archived</h3>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {archivedUser.map(c => <CategoryCard key={c.id} c={c} />)}
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        <section>
          <h2 className="mb-4 text-lg font-bold text-slate-700 dark:text-slate-300">System Categories</h2>
          <p className="mb-4 text-sm text-slate-500">Built-in categories available to everyone.</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 opacity-80">
            {systemCategories.map(c => <CategoryCard key={c.id} c={c} isSystem />)}
          </div>
        </section>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit category' : 'New category'}>
        <form className="space-y-4" onSubmit={saveCategory}>
          {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
          
          <div><label className="label">Name</label><input className="field" required maxLength={60} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="E.g. Groceries" /></div>
          
          <div>
            <label className="label">Type</label>
            <select className="field" value={form.category_type} onChange={(e) => setForm({ ...form, category_type: e.target.value })}>
              <option value="EXPENSE">Expense</option>
              <option value="INCOME">Income</option>
            </select>
          </div>

          <div>
            <label className="label">Icon</label>
            <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 rounded-xl border bg-slate-50 dark:bg-slate-900/50 dark:border-slate-800">
              {Object.keys(ICON_MAP).map((iconName) => (
                <button
                  key={iconName}
                  type="button"
                  onClick={() => setForm({ ...form, icon: iconName })}
                  className={`flex h-10 w-10 items-center justify-center rounded-lg transition ${form.icon === iconName ? 'bg-brand-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-800'}`}
                >
                  <EntityIcon name={iconName} size={20} />
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border p-3 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <input className="h-9 w-12 cursor-pointer rounded-lg border p-1" type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value.toUpperCase() })} />
              <span className="text-sm text-slate-500">Category color</span>
            </div>
            <span className="grid h-10 w-10 place-items-center rounded-xl text-white shadow-sm" style={{ background: form.color.toUpperCase() }}>
              <EntityIcon name={form.icon} size={20} />
            </span>
          </div>

          <button className="btn-primary w-full" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Create category'}</button>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmArchive)}
        title="Archive category?"
        message={`"${confirmArchive?.name}" will be archived. It won't affect past transactions.`}
        onConfirm={async () => {
          if (confirmArchive) {
            await updateCategory(confirmArchive.id, { is_archived: true });
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
