import { AlertTriangle } from 'lucide-react';

export default function ConfirmDialog({ open, title, message, confirmLabel = 'Delete', onConfirm, onCancel, danger = true }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/55 backdrop-blur-sm p-4" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="w-full max-w-sm animate-fade-in rounded-2xl border bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900" role="alertdialog" aria-labelledby="confirm-title" aria-describedby="confirm-msg">
        <div className="flex items-center gap-3">
          {danger && (
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400">
              <AlertTriangle size={20} />
            </span>
          )}
          <h2 id="confirm-title" className="text-lg font-bold">{title || 'Are you sure?'}</h2>
        </div>
        <p id="confirm-msg" className="mt-3 text-sm text-slate-600 dark:text-slate-400">{message || 'This action cannot be undone.'}</p>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button onClick={onCancel} className="btn-secondary">Cancel</button>
          <button onClick={onConfirm} className={danger ? 'btn-danger' : 'btn-primary'}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
