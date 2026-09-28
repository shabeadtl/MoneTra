import { useEffect } from 'react';
import { Check, X, AlertCircle, Info } from 'lucide-react';

const ICONS = { success: Check, error: AlertCircle, info: Info };
const STYLES = {
  success: 'bg-emerald-600 text-white',
  error: 'bg-red-600 text-white',
  info: 'bg-slate-800 text-white dark:bg-slate-700',
};

export default function Toast({ message, type = 'success', onClose, duration = 3500 }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [message, onClose, duration]);

  if (!message) return null;

  const Icon = ICONS[type] || ICONS.info;

  return (
    <div className="fixed bottom-24 left-1/2 z-[60] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 lg:bottom-6 animate-slide-up" role="status" aria-live="polite">
      <div className={`flex items-center gap-2.5 rounded-2xl px-4 py-3 text-sm font-semibold shadow-2xl ${STYLES[type]}`}>
        <Icon size={17} className="shrink-0" />
        <span className="flex-1">{message}</span>
        <button onClick={onClose} className="ml-1 rounded-lg p-1 transition hover:bg-white/20" aria-label="Dismiss">
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
