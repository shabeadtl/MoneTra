import { describe, it, expect } from 'vitest';
import { calculateNetWorth, calculateBudgetUsage, calculateGoalProgress, calculateIncomeExpenses } from './finance';

describe('Financial Calculations', () => {

  describe('Net Worth', () => {
    it('calculates correctly based on cash, invested assets, and owed liabilities', () => {
      const accounts = [
        { balance: 50000, is_archived: false },
        { balance: 20000, is_archived: false },
        { balance: 10000, is_archived: true }, // should be ignored
      ];
      const assets = [
        { current_value: 150000 },
        { purchase_price: 30000 }, // fallback to purchase price
      ];
      const liabilities = [
        { remaining_balance: 40000 },
        { amount: 10000 }, // fallback to amount
      ];

      const result = calculateNetWorth(accounts, assets, liabilities);
      
      expect(result.cash).toBe(70000);
      expect(result.invested).toBe(180000);
      expect(result.owed).toBe(50000);
      expect(result.total).toBe(70000 + 180000 - 50000); // 200000
    });
  });

  describe('Budget Usage', () => {
    const budget = { year: 2024, month: 6, scope: 'CATEGORY', category_id: '123', limit_amount: 10000 };

    it('counts matching expenses and ignores income, transfers, and mismatches', () => {
      const transactions = [
        { type: 'EXPENSE', amount: 5000, date: '2024-06-15', category_id: '123' }, // matches
        { type: 'EXPENSE', amount: 2000, date: '2024-06-20', category_id: '123' }, // matches
        { type: 'EXPENSE', amount: 1000, date: '2024-05-20', category_id: '123' }, // wrong month
        { type: 'EXPENSE', amount: 1000, date: '2024-06-20', category_id: '999' }, // wrong category
        { type: 'INCOME', amount: 5000, date: '2024-06-20', category_id: '123' },  // wrong type
        { type: 'EXPENSE', amount: 2000, date: '2024-06-20', category_id: '123', transfer_id: 'abc' }, // transfer leg
      ];

      const result = calculateBudgetUsage(budget, transactions);
      
      expect(result.spent).toBe(7000);
      expect(result.percent).toBe(70);
    });

    it('caps percentage at 100 when over limit', () => {
      const transactions = [
        { type: 'EXPENSE', amount: 12000, date: '2024-06-15', category_id: '123' },
      ];
      const result = calculateBudgetUsage(budget, transactions);
      
      expect(result.spent).toBe(12000);
      expect(result.percent).toBe(100);
    });
  });

  describe('Goal Progress', () => {
    it('calculates goal progress accurately', () => {
      const goal = { target_amount: 100000, saved_amount: 40000 };
      const result = calculateGoalProgress(goal);
      
      expect(result.target).toBe(100000);
      expect(result.saved).toBe(40000);
      expect(result.remaining).toBe(60000);
      expect(result.percent).toBe(40);
      expect(result.achieved).toBe(false);
    });

    it('handles completed goals and prevents negative remaining', () => {
      const goal = { target_amount: 50000, saved_amount: 60000 };
      const result = calculateGoalProgress(goal);
      
      expect(result.remaining).toBe(0);
      expect(result.percent).toBe(100);
      expect(result.achieved).toBe(true);
    });
    
    it('handles zero target safely', () => {
      const goal = { target_amount: 0, saved_amount: 0 };
      const result = calculateGoalProgress(goal);
      expect(result.percent).toBe(0);
    });
  });

  describe('Income vs Expenses', () => {
    it('calculates totals while completely excluding transfers', () => {
      const transactions = [
        { type: 'INCOME', amount: 50000 },
        { type: 'EXPENSE', amount: 20000 },
        { type: 'EXPENSE', amount: 5000, transfer_id: 't1' }, // Transfer leg
        { type: 'INCOME', amount: 5000, transfer_id: 't1' },  // Transfer leg
      ];

      const result = calculateIncomeExpenses(transactions);
      
      expect(result.income).toBe(50000);
      expect(result.expenses).toBe(20000);
      expect(result.savings).toBe(30000);
    });
  });

});
