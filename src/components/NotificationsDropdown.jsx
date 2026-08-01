import { useEffect, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, Bell, CheckCircle2, Info, MailCheck } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { useDataStore } from '../stores/dataStore';
import EmptyState from './EmptyState';

const META = {
  INFO:    { Icon: Info,         classes: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300' },
  SUCCESS: { Icon: CheckCircle2, classes: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' },
  WARNING: { Icon: AlertTriangle,classes: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' },
  ERROR:   { Icon: AlertCircle,  classes: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300' },
};

export default function NotificationsDropdown() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const { notifications, markNotification, markAllNotifications } = useDataStore();
  const unread = notifications.filter((n) => !n.is_read).length;

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-200"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-900" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 origin-top-right rounded-2xl border bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900 z-50 animate-fade-in flex flex-col overflow-hidden max-h-[80vh]">
          <div className="flex items-center justify-between border-b px-4 py-3 dark:border-slate-800">
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100">Notifications</h3>
              {unread > 0 && <p className="text-xs text-slate-500">{unread} unread</p>}
            </div>
            <button
              className="flex items-center gap-1.5 text-xs font-semibold text-brand-600 transition hover:text-brand-700 disabled:opacity-50 dark:text-brand-400 dark:hover:text-brand-300"
              disabled={!unread}
              onClick={() => {
                markAllNotifications();
                setOpen(false);
              }}
            >
              <MailCheck size={14} /> Mark all read
            </button>
          </div>

          <div className="overflow-y-auto divide-y dark:divide-slate-800">
            {notifications.map((note) => {
              const { Icon, classes } = META[note.type] ?? META.INFO;
              return (
                <button
                  key={note.id}
                  onClick={() => !note.is_read && markNotification(note.id)}
                  className={`flex w-full gap-3 p-4 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                    !note.is_read ? 'bg-brand-50/30 dark:bg-brand-900/10' : ''
                  }`}
                >
                  <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${classes}`}>
                    <Icon size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm leading-snug ${!note.is_read ? 'font-semibold text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}>
                      {note.message}
                    </p>
                    <p className="mt-1 text-xs font-medium text-slate-400">
                      {formatDistanceToNow(parseISO(note.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  {!note.is_read && (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                  )}
                </button>
              );
            })}

            {!notifications.length && (
              <div className="py-4">
                <EmptyState
                  icon={Bell}
                  title="You're all caught up"
                  message="Activity updates will appear here."
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
