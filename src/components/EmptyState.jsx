import { Inbox } from 'lucide-react';

export default function EmptyState({
  title = 'Nothing here yet',
  message = 'Your records will appear here once you add them.',
  icon: Icon = Inbox,
  action,
}) {
  return (
    <div className="flex animate-fade-in flex-col items-center px-4 py-16 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand-500 shadow-inner dark:from-brand-950/40 dark:to-brand-900/30 dark:text-brand-400">
        <Icon size={28} strokeWidth={1.5} />
      </div>
      <h3 className="text-base font-bold text-slate-700 dark:text-slate-200">{title}</h3>
      <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-slate-500 dark:text-slate-400">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
