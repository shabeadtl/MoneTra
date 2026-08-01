import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { LogOut, Settings } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';

export default function ProfileDropdown({ onSignOut }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const { profile, user } = useAuthStore();
  const initial = profile?.full_name?.[0] || user?.email?.[0]?.toUpperCase() || 'U';

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const avatar = (size = 'h-9 w-9', text = 'text-sm') =>
    profile?.avatar_url
      ? <img src={profile.avatar_url} className={`${size} rounded-full object-cover`} alt="" />
      : (
        <span className={`grid ${size} place-items-center rounded-full bg-brand-100 ${text} font-bold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300`}>
          {initial}
        </span>
      );

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex h-9 w-9 items-center justify-center rounded-full ring-2 ring-transparent transition hover:ring-brand-200 dark:hover:ring-brand-800"
        aria-label="Account menu"
      >
        {avatar()}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-64 origin-top-right overflow-hidden rounded-2xl border bg-white shadow-xl animate-fade-in dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3 border-b px-4 py-3.5 dark:border-slate-800">
            {avatar('h-10 w-10', 'text-base')}
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">{profile?.full_name || 'User'}</p>
              <p className="truncate text-xs text-slate-500">{user?.email}</p>
            </div>
          </div>
          <div className="p-2">
            <Link
              to="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Settings size={16} /> Settings
            </Link>
            <button
              onClick={() => { setOpen(false); onSignOut(); }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              <LogOut size={16} /> Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
