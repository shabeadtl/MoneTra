import { X } from 'lucide-react';

export default function Modal({ open, onClose, title, children, size = 'max-w-lg' }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 backdrop-blur-sm p-0 md:items-center md:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        className={`w-full ${size} animate-slide-up rounded-t-3xl border-t bg-white shadow-2xl dark:bg-slate-900 md:my-auto md:animate-fade-in md:rounded-2xl md:border`}
      >
        {/* Drag handle decoration for mobile bottom sheet */}
        <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-slate-200 dark:bg-slate-700 md:hidden" />

        <header className="flex items-center justify-between border-b px-5 pb-4 pt-2 md:pt-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={19} />
          </button>
        </header>

        <div className="p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:pb-5">
          {children}
        </div>
      </section>
    </div>
  );
}
