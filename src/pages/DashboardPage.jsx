import { useEffect, useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Plus, TrendingUp, Wallet } from 'lucide-react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts';
import { format, isSameMonth, parseISO, startOfWeek, addDays } from 'date-fns';
import Modal from '../components/Modal';
import TransactionForm from '../components/TransactionForm';
import EmptyState from '../components/EmptyState';
import Spinner from '../components/Spinner';
import { useAuthStore } from '../stores/authStore';
import { useDataStore } from '../stores/dataStore';
import { money, prettyDate } from '../lib/utils';

/* ── Custom tooltip ── */
function ChartTooltip({ active, payload, label, currency }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border bg-white px-3 py-2 shadow-lg dark:border-slate-700 dark:bg-slate-800">
      {label && <p className="mb-1 text-xs font-semibold text-slate-500">{label}</p>}
      {payload.map((p) => (
        <p key={p.name} className="text-sm font-bold" style={{ color: p.color || p.fill }}>
          {p.name ? `${p.name}: ` : ''}{money(p.value, currency)}
        </p>
      ))}
    </div>
  );
}

function FormattedMoney({ value, currency }) {
  const str = money(value, currency);
  const match = str.match(/^(.*)(\.\d{2})$/);
  if (match) {
    return <>{match[1]}<span className="text-[0.65em] font-bold opacity-70">{match[2]}</span></>;
  }
  return <>{str}</>;
}

export default function DashboardPage() {
  const [add, setAdd] = useState(false);
  const profile = useAuthStore((s) => s.profile);
  const { transactions, loading } = useDataStore();
  const currency = profile?.currency || 'INR';

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        setAdd(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  /* ── Stat cards ── */
  const stats = useMemo(() => {
    const now = new Date();
    let income = 0, expenses = 0, monthlyIncome = 0, monthlyExpenses = 0;
    transactions.forEach((t) => {
      const amount = Number(t.amount);
      if (t.type === 'INCOME') {
        income += amount;
        if (isSameMonth(parseISO(t.date), now)) monthlyIncome += amount;
      } else {
        expenses += amount;
        if (isSameMonth(parseISO(t.date), now)) monthlyExpenses += amount;
      }
    });
    return { balance: income - expenses, monthlyIncome, monthlyExpenses };
  }, [transactions]);

  /* ── Pie: category breakdown this month ── */
  const categoryData = useMemo(() =>
    Object.values(
      transactions
        .filter((t) => t.type === 'EXPENSE' && isSameMonth(parseISO(t.date), new Date()))
        .reduce((acc, t) => {
          const name = t.categories?.name || 'Other';
          acc[name] ||= { name, value: 0, color: t.categories?.color || '#64748B' };
          acc[name].value += Number(t.amount);
          return acc;
        }, {})
    ),
  [transactions]);

  /* ── Bar: last 6 months income vs expense ── */
  const monthlyData = useMemo(() =>
    Array.from({ length: 6 }, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - (5 - i));
      const rows = transactions.filter((t) => isSameMonth(parseISO(t.date), d));
      return {
        month: format(d, 'MMM'),
        Income: rows.filter((x) => x.type === 'INCOME').reduce((s, x) => s + Number(x.amount), 0),
        Expense: rows.filter((x) => x.type === 'EXPENSE').reduce((s, x) => s + Number(x.amount), 0),
      };
    }),
  [transactions]);

  /* ── Area: weekly spending ── */
  const weekData = useMemo(() => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => {
      const day = addDays(start, i);
      return {
        day: format(day, 'EEE'),
        value: transactions
          .filter((t) => t.type === 'EXPENSE' && t.date === format(day, 'yyyy-MM-dd'))
          .reduce((s, x) => s + Number(x.amount), 0),
      };
    });
  }, [transactions]);

  const cards = [
    { label: 'Total balance', value: stats.balance, Icon: Wallet, color: 'text-brand-700 bg-brand-50 dark:bg-brand-900/30 dark:text-brand-300', accent: 'border-t-[3px] border-t-brand-500 shadow-[0_4px_20px_-4px_rgba(15,118,110,0.15)]' },
    { label: 'Monthly income', value: stats.monthlyIncome, Icon: ArrowUpRight, color: 'text-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-300', accent: 'border-t-[3px] border-t-emerald-500 shadow-[0_4px_20px_-4px_rgba(16,185,129,0.15)]' },
    { label: 'Monthly expenses', value: stats.monthlyExpenses, Icon: ArrowDownRight, color: 'text-red-700 bg-red-50 dark:bg-red-900/30 dark:text-red-300', accent: 'border-t-[3px] border-t-red-500 shadow-[0_4px_20px_-4px_rgba(239,68,68,0.15)]' },
  ];

  const yAxisFormatter = (val) => {
    const symbol = currency === 'INR' ? '₹' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '£';
    return val >= 1000 ? `${symbol}${(val / 1000).toFixed(0)}k` : `${symbol}${val}`;
  };

  if (loading && !transactions.length) return <Spinner full label="Loading your data…" />;

  return (
    <>
      {/* Header */}
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{format(new Date(), 'EEEE, dd MMMM yyyy')}</p>
          <h1 className="mt-1 text-3xl font-black">
            Hello, {profile?.full_name?.split(' ')[0] || 'there'}! 👋
          </h1>
          <p className="mt-1 font-medium text-slate-600 dark:text-slate-400">Here&apos;s your money at a glance.</p>
        </div>
        <button className="btn-primary flex items-center gap-2 transition hover:scale-[1.02] active:scale-95 shadow-[0_4px_20px_-4px_rgba(15,118,110,0.4)]" onClick={() => setAdd(true)}>
          <Plus size={18} /> Add transaction
          <span className="ml-1 rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white border border-white/10">(N)</span>
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {cards.map(({ label, value, Icon, color, accent }) => (
          <div className={`card group relative overflow-hidden ${accent}`} key={label}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">{label}</p>
              <span className={`rounded-xl p-2.5 transition group-hover:scale-110 ${color}`}>
                <Icon size={20} />
              </span>
            </div>
            <p className="mt-5 text-3xl font-black tracking-tight">
              <FormattedMoney value={value} currency={currency} />
            </p>
            {/* subtle decorative bar at bottom */}
            <div className={`absolute bottom-0 left-0 right-0 h-0.5 opacity-30 ${
              label.includes('balance') ? 'bg-brand-500' :
              label.includes('income') ? 'bg-emerald-500' : 'bg-red-500'
            }`} />
          </div>
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="mt-6 grid gap-6 xl:grid-cols-5">
        <section className="card xl:col-span-3">
          <h2 className="font-bold">Income vs Expenses</h2>
          <p className="mb-5 text-sm text-slate-500">Last six months</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis width={65} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={yAxisFormatter} />
                <Tooltip content={<ChartTooltip currency={currency} />} cursor={{ fill: 'transparent' }} />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }} />
                <Bar dataKey="Income" fill="#10B981" radius={[6, 6, 0, 0]} maxBarSize={40} />
                <Bar dataKey="Expense" fill="#EF4444" radius={[6, 6, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card xl:col-span-2">
          <h2 className="font-bold">Expense Split</h2>
          <p className="mb-5 text-sm text-slate-500">This month by category</p>
          <div className="h-72">
            {categoryData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={3}
                    strokeWidth={0}
                  >
                    {categoryData.map((x) => <Cell key={x.name} fill={x.color} />)}
                  </Pie>
                  <Tooltip content={<ChartTooltip currency={currency} />} />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState 
                title="No expenses this month" 
                message="Add an expense to see your category breakdown." 
                action={<button className="btn-secondary" onClick={() => setAdd(true)}>+ Add Expense</button>} 
              />
            )}
          </div>
        </section>
      </div>

      {/* Charts row 2 */}
      <div className="mt-6 grid gap-6 xl:grid-cols-5">
        <section className="card xl:col-span-3">
          <h2 className="font-bold">Weekly Spending</h2>
          <p className="mb-5 text-sm text-slate-500">Daily expenses this week</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weekData}>
                <defs>
                  <linearGradient id="weekGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0f766e" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#0f766e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis width={65} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={yAxisFormatter} />
                <Tooltip content={<ChartTooltip currency={currency} />} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#0f766e"
                  strokeWidth={2.5}
                  fill="url(#weekGrad)"
                  dot={{ fill: '#0f766e', r: 4, strokeWidth: 0 }}
                  activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card xl:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Recent Activity</h2>
            <TrendingUp size={16} className="text-slate-400" />
          </div>
          <div className="mt-4 divide-y">
            {transactions.slice(0, 5).map((t) => (
              <div className="flex items-center gap-3 py-3" key={t.id}>
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white text-xs font-bold"
                  style={{ background: t.categories?.color || '#64748B' }}
                >
                  {t.categories?.name?.[0]?.toUpperCase() || '?'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{t.title}</p>
                  <p className="text-xs text-slate-500">{prettyDate(t.date)} · {t.categories?.name}</p>
                </div>
                <p className={`shrink-0 text-sm font-bold ${t.type === 'INCOME' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'}`}>
                  {t.type === 'INCOME' ? '+' : '-'}{money(t.amount, currency)}
                </p>
              </div>
            ))}
            {!transactions.length && (
              <EmptyState title="No transactions yet" message="Add your first income or expense to get started." />
            )}
          </div>
        </section>
      </div>

      {/* Add transaction modal */}
      <Modal open={add} onClose={() => setAdd(false)} title="Add transaction">
        <TransactionForm onDone={() => setAdd(false)} />
      </Modal>
    </>
  );
}
