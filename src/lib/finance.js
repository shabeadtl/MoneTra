export function calculateNetWorth(accounts, assets, liabilities) {
  const cash = accounts.filter((a) => !a.is_archived).reduce((s, a) => s + Number(a.balance || 0), 0);
  const invested = assets.reduce((s, a) => s + Number(a.current_value || a.purchase_price || 0), 0);
  const owed = liabilities.reduce((s, l) => s + Number(l.remaining_balance || l.amount || 0), 0);
  return { cash, invested, owed, total: cash + invested - owed };
}

export function calculateBudgetUsage(budget, transactions) {
  const spent = transactions
    .filter((t) => {
      if (t.type !== 'EXPENSE' || t.transfer_id || Number(t.date.slice(0, 4)) !== budget.year || Number(t.date.slice(5, 7)) !== budget.month) return false;
      if (budget.scope === 'CATEGORY') return t.category_id === budget.category_id;
      if (budget.scope === 'ACCOUNT') return t.account_id === budget.account_id;
      return true;
    })
    .reduce((s, t) => s + Number(t.amount), 0);
  return { spent, percent: Math.min(100, (spent / Number(budget.limit_amount)) * 100) };
}

export function calculateGoalProgress(goal) {
  const target = Number(goal.target_amount || 0);
  const saved = Number(goal.saved_amount || 0);
  const percent = target > 0 ? Math.min(100, (saved / target) * 100) : 0;
  return { target, saved, remaining: Math.max(0, target - saved), percent, achieved: saved >= target };
}

export function calculateIncomeExpenses(transactions) {
  let income = 0;
  let expenses = 0;
  transactions.forEach((t) => {
    if (t.transfer_id) return;
    const amt = Number(t.amount || 0);
    if (t.type === 'INCOME') income += amt;
    else if (t.type === 'EXPENSE') expenses += amt;
  });
  return { income, expenses, savings: income - expenses };
}
