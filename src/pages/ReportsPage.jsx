import { useMemo, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { format } from 'date-fns';
import { useAuthStore } from '../stores/authStore';
import { useDataStore } from '../stores/dataStore';
import EmptyState from '../components/EmptyState';
import { money } from '../lib/utils';

const RANGES = [
  { key: 'this-month', label: 'This month' },
  { key: 'last-month', label: 'Last month' },
  { key: 'last-3', label: 'Last 3 months' },
  { key: 'this-year', label: 'This year' },
  { key: 'last-year', label: 'Last year' },
  { key: 'custom', label: 'Custom' },
];

function rangeToInterval(key) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  switch (key) {
    case 'this-month': return { from: `${year}-${String(month + 1).padStart(2, '0')}-01`, to: format(now, 'yyyy-MM-dd') };
    case 'last-month': { const d = new Date(year, month - 1, 1); return { from: format(d, 'yyyy-MM-dd'), to: format(new Date(year, month, 0), 'yyyy-MM-dd') }; }
    case 'last-3': { const d = new Date(year, month - 2, 1); return { from: format(d, 'yyyy-MM-dd'), to: format(now, 'yyyy-MM-dd') }; }
    case 'this-year': return { from: `${year}-01-01`, to: format(now, 'yyyy-MM-dd') };
    case 'last-year': return { from: `${year - 1}-01-01`, to: `${year - 1}-12-31` };
    default: return { from: '', to: '' };
  }
}

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


export default function ReportsPage() {
  const currency = useAuthStore((s) => s.profile?.currency || 'INR');
  const { transactions } = useDataStore();
  const [range, setRange] = useState('this-month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const interval = range === 'custom' ? { from: customFrom, to: customTo } : rangeToInterval(range);

  const filtered = useMemo(() => {
    if (!interval.from && !interval.to) return transactions.filter((t) => !t.transfer_id);
    return transactions.filter((t) => {
      if (t.transfer_id) return false;
      if (interval.from && t.date < interval.from) return false;
      if (interval.to && t.date > interval.to) return false;
      return true;
    });
  }, [transactions, interval.from, interval.to]);

  const summary = useMemo(() => {
    let income = 0, expense = 0;
    filtered.forEach((t) => {
      if (t.type === 'INCOME') income += Number(t.amount);
      else if (t.type === 'EXPENSE') expense += Number(t.amount);
    });
    return { income, expense, savings: income - expense };
  }, [filtered]);

  const categoryData = useMemo(() =>
    Object.values(
      filtered
        .filter((t) => t.type === 'EXPENSE')
        .reduce((acc, t) => {
          const name = t.categories?.name || 'Other';
          acc[name] ||= { name, value: 0, color: t.categories?.color || '#64748B', count: 0 };
          acc[name].value += Number(t.amount);
          acc[name].count += 1;
          return acc;
        }, {})
    ).sort((a, b) => b.value - a.value),
  [filtered]);

  const totalExpense = categoryData.reduce((s, c) => s + c.value, 0);

  /* Monthly trend within the filtered range */
  const trendData = useMemo(() => {
    const map = {};
    filtered.forEach((t) => {
      const key = t.date.slice(0, 7); // YYYY-MM
      map[key] ||= { key, label: '', Income: 0, Expense: 0 };
      if (t.type === 'INCOME') map[key].Income += Number(t.amount);
      else if (t.type === 'EXPENSE') map[key].Expense += Number(t.amount);
    });
    return Object.values(map)
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((d) => ({ ...d, label: format(new Date(d.key + '-01T00:00:00'), 'MMM yy') }));
  }, [filtered]);

  const yAxisFormatter = (val) => {
    const symbol = currency === 'INR' ? '₹' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '£';
    return val >= 1000 ? `${symbol}${(val / 1000).toFixed(0)}k` : `${symbol}${val}`;
  };

  const activeRange = RANGES.find((r) => r.key === range);

  return (
    <>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black">Reports</h1>
          <p className="mt-1 text-slate-500">Income, expenses, savings, and category trends.</p>
        </div>
      </div>

      {/* Date range selector */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={`rounded-xl px-3 py-1.5 text-sm font-semibold transition ${range === r.key ? 'bg-brand-700 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}
          >
            {r.label}
          </button>
        ))}
      </div>
      {range === 'custom' && (
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <div><label className="label">From</label><input className="field max-w-44" type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} /></div>
          <div><label className="label">To</label><input className="field max-w-44" type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} /></div>
        </div>
      )}

      {/* Summary cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card !p-5">
          <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Income</p>
          <p className="mt-1 text-2xl font-black tracking-tight">{money(summary.income, currency)}</p>
        </div>
        <div className="card !p-5">
          <p className="text-sm font-medium text-red-600 dark:text-red-400">Expenses</p>
          <p className="mt-1 text-2xl font-black tracking-tight">{money(summary.expense, currency)}</p>
        </div>
        <div className={`card !p-5 border-t-[3px] ${summary.savings >= 0 ? 'border-t-brand-500' : 'border-t-red-500'}`}>
          <p className="text-sm font-medium text-slate-500">Savings</p>
          <p className={`mt-1 text-2xl font-black tracking-tight ${summary.savings >= 0 ? 'text-brand-700 dark:text-brand-300' : 'text-red-600 dark:text-red-400'}`}>{money(summary.savings, currency)}</p>
        </div>
        <div className="card !p-5">
          <p className="text-sm font-medium text-slate-500">Transactions</p>
          <p className="mt-1 text-2xl font-black tracking-tight">{filtered.length}</p>
        </div>
      </div>

      {filtered.length === 0 ? (
        <section className="card">
          <EmptyState icon={BarChart3} title="Nothing to report" message={`No transactions found for ${activeRange?.label || 'selected period'}. Try a different date range.`} />
        </section>
      ) : (
        <>
          <div className="grid gap-6 xl:grid-cols-5">
            {/* Income vs expense trend */}
            <section className="card xl:col-span-3">
              <h2 className="font-bold">Income vs Expenses</h2>
              <p className="mb-5 text-sm text-slate-500">Monthly breakdown</p>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trendData} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis width={60} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={yAxisFormatter} />
                    <Tooltip content={<ChartTooltip currency={currency} />} cursor={{ fill: 'transparent' }} />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }} />
                    <Bar dataKey="Income" fill="#10B981" radius={[6, 6, 0, 0]} maxBarSize={34} />
                    <Bar dataKey="Expense" fill="#EF4444" radius={[6, 6, 0, 0]} maxBarSize={34} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Category pie */}
            <section className="card xl:col-span-2">
              <h2 className="font-bold">Spending by Category</h2>
              <p className="mb-5 text-sm text-slate-500">Expenses in the selected period</p>
              <div className="h-80">
                {categoryData.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={categoryData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3} strokeWidth={0}>
                        {categoryData.map((x) => <Cell key={x.name} fill={x.color} />)}
                      </Pie>
                      <Tooltip content={<ChartTooltip currency={currency} />} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState title="No expenses" message="No expense transactions in this period." />
                )}
              </div>
            </section>
          </div>

          {/* Category breakdown table */}
          {categoryData.length > 0 && (
            <section className="card mt-6">
              <h2 className="font-bold">Category Breakdown</h2>
              <p className="mb-4 text-sm text-slate-500">Detailed expense split</p>
              <div className="divide-y">
                {categoryData.map((c) => (
                  <div key={c.name} className="flex items-center gap-3 py-3">
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: c.color }} />
                    <span className="flex-1 text-sm font-semibold">{c.name}</span>
                    <span className="text-xs text-slate-500">{c.count} txn{c.count !== 1 ? 's' : ''}</span>
                    <span className="text-xs font-medium text-slate-500">{totalExpense ? Math.round((c.value / totalExpense) * 100) : 0}%</span>
                    <span className="min-w-24 text-right text-sm font-bold">{money(c.value, currency)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}

