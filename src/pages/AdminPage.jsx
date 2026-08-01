import { useEffect, useState } from 'react';
import { Activity, ArrowDownRight, ArrowUpRight, RefreshCw, Users } from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts';
import { requireSupabase } from '../lib/supabase';
import { money, messageFrom } from '../lib/utils';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';

export default function AdminPage() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const { data, error: e } = await requireSupabase().rpc('get_admin_stats');
      if (e) throw e;
      setStats(data);
    } catch (err) {
      setError(messageFrom(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) return <Spinner full label="Loading system diagnostics…" />;

  if (error) {
    return (
      <div className="card flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-4xl">🔒</p>
        <h2 className="text-xl font-bold">Access Denied</h2>
        <p className="max-w-sm text-sm text-slate-500">{error}</p>
        <button className="btn-secondary" onClick={load}>
          <RefreshCw size={16} /> Retry
        </button>
      </div>
    );
  }

  const cards = [
    { label: 'Registered users',  value: stats.users,                Icon: Users,         color: 'text-brand-700 bg-brand-50 dark:bg-brand-900/30 dark:text-brand-300' },
    { label: 'Total transactions', value: stats.transactions,         Icon: Activity,      color: 'text-violet-700 bg-violet-50 dark:bg-violet-900/30 dark:text-violet-300' },
    { label: 'Total income',       value: money(stats.income),        Icon: ArrowUpRight,  color: 'text-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-300' },
    { label: 'Total expenses',     value: money(stats.expenses),      Icon: ArrowDownRight,color: 'text-red-700 bg-red-50 dark:bg-red-900/30 dark:text-red-300' },
  ];

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-brand-700 dark:text-brand-400">Staff only</p>
          <h1 className="mt-1 text-3xl font-black">System Diagnostics</h1>
          <p className="mt-1 text-slate-500">Privacy-safe aggregate health metrics across Monetra.</p>
        </div>
        <button className="btn-secondary" onClick={load}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, Icon, color }) => (
          <div className="card group" key={label}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">{label}</p>
              <span className={`rounded-xl p-2.5 transition group-hover:scale-110 ${color}`}>
                <Icon size={19} />
              </span>
            </div>
            <p className="mt-4 text-2xl font-black">{value}</p>
          </div>
        ))}
      </div>

      {/* Registrations chart */}
      <section className="card mt-6">
        <h2 className="font-bold">New Registrations</h2>
        <p className="mb-5 text-sm text-slate-500">New accounts over the last 30 days</p>
        <div className="h-72">
          {stats.registrations?.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.registrations}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v) => [v, 'Signups']}
                  contentStyle={{ borderRadius: '12px', fontSize: '13px' }}
                />
                <Bar dataKey="count" fill="#0f766e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState title="No registrations yet" message="New user signups from the last 30 days will appear here." />
          )}
        </div>
      </section>

      {/* Health summary */}
      <section className="card mt-6">
        <h2 className="font-bold">Platform Overview</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Avg transactions/user</p>
            <p className="mt-2 text-2xl font-black">
              {stats.users > 0 ? (stats.transactions / stats.users).toFixed(1) : '—'}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Net platform balance</p>
            <p className={`mt-2 text-2xl font-black ${stats.income >= stats.expenses ? 'text-emerald-600' : 'text-red-600'}`}>
              {money(stats.income - stats.expenses)}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Income/expense ratio</p>
            <p className="mt-2 text-2xl font-black">
              {stats.expenses > 0 ? (stats.income / stats.expenses).toFixed(2) : '∞'}
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
