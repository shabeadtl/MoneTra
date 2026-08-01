import { AlertCircle, AlertTriangle, Bell, CheckCircle2, Info, MailCheck } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { useDataStore } from '../stores/dataStore';
import EmptyState from '../components/EmptyState';

const META = {
  INFO:    { Icon: Info,         classes: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',     border: 'border-blue-100 dark:border-blue-900/30' },
  SUCCESS: { Icon: CheckCircle2, classes: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300', border: 'border-emerald-100 dark:border-emerald-900/30' },
  WARNING: { Icon: AlertTriangle,classes: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300', border: 'border-amber-100 dark:border-amber-900/30' },
  ERROR:   { Icon: AlertCircle,  classes: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300',         border: 'border-red-100 dark:border-red-900/30' },
};

export default function NotificationsPage() {
  const { notifications, markNotification, markAllNotifications } = useDataStore();
  const unread = notifications.filter((n) => !n.is_read).length;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black">Notifications</h1>
          <p className="mt-1 text-slate-500">Budget warnings and activity updates in one place.</p>
        </div>
        <div className="flex items-center gap-3">
          {unread > 0 && (
            <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {unread} unread
            </span>
          )}
          <button className="btn-secondary" disabled={!unread} onClick={markAllNotifications}>
            <MailCheck size={17} /> Mark all read
          </button>
        </div>
      </div>

      <section className="card divide-y p-0 overflow-hidden">
        {notifications.map((note) => {
          const { Icon, classes } = META[note.type] ?? META.INFO;
          return (
            <button
              key={note.id}
              onClick={() => !note.is_read && markNotification(note.id)}
              className={`flex w-full gap-4 p-5 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/50
                ${!note.is_read ? 'bg-brand-50/30 dark:bg-brand-900/5' : ''}`}
            >
              <span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${classes}`}>
                <Icon size={20} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-2">
                  <b className="text-sm capitalize">
                    {note.type[0] + note.type.slice(1).toLowerCase()}
                  </b>
                  {!note.is_read && (
                    <span className="h-2 w-2 rounded-full bg-brand-600 dark:bg-brand-400" />
                  )}
                </span>
                <span className="mt-1 block text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {note.message}
                </span>
                <span className="mt-2 block text-xs text-slate-400">
                  {formatDistanceToNow(parseISO(note.created_at), { addSuffix: true })}
                </span>
              </span>
              {!note.is_read && (
                <span className="text-xs font-medium text-brand-600 dark:text-brand-400 self-center shrink-0">
                  Tap to mark read
                </span>
              )}
            </button>
          );
        })}

        {!notifications.length && (
          <EmptyState
            icon={Bell}
            title="You're all caught up"
            message="Budget alerts and account activity will appear here automatically."
          />
        )}
      </section>
    </>
  );
}
