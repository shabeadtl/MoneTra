# Monetra — Schema & Architecture

Monetra evolved from an expense tracker into a personal money-management platform.
Everything below is **backwards compatible** — the original `transactions`,
`categories`, `budgets` and `notifications` tables are untouched in shape; new
columns and tables were added on top, and all historical data is preserved.

## Data model (added by `supabase/migrations/002_money_platform.sql`)

```
accounts     — where money lives (cash, savings, current, credit card, loan,
               investment, digital wallet, business, other)
transfers    — money moved between the user's own accounts
assets       — gold, stocks, crypto, real estate, mutual funds, fixed deposits
liabilities  — credit cards, loans, debts, EMI, mortgage
goals        — savings targets with deadline + priority
```

### Extended existing tables

| Table          | Added                                  | Purpose |
|----------------|----------------------------------------|---------|
| `categories`   | `category_type` (INCOME/EXPENSE/TRANSFER), `is_system` | typed + shared categories |
| `transactions` | `account_id`, `transfer_id`            | link transactions to accounts and transfer legs |
| `budgets`      | `scope` (CATEGORY/ACCOUNT/TOTAL), `account_id` | category, account or overall budgets |

## Balance logic

An account's balance is **derived**, never hand-edited:

```
balance = opening_balance + Σ income − Σ expenses
```

- The `apply_transaction_to_accounts` trigger updates the account balance on
  every transaction INSERT / UPDATE / DELETE.
- `recomputeBalances()` in the client recalculates from source data so local
  edits and offline replay stay consistent.

## Transfer system

`create_transfer(user, source, dest, amount, date, description)` is an **atomic
RPC** (security definer) that:

1. Validates the user owns both accounts and they differ.
2. Creates the `transfers` row.
3. Creates two transaction legs — an expense on the source and an income on the
   destination — linked by `transfer_id`, so balances move and history is kept.

## RLS

Every new table has full CRUD policies scoped to `auth.uid() = user_id`. The
transaction INSERT/UPDATE policy was tightened to only allow categories the user
owns (or shared system categories) and accounts the user owns.

## System categories

Shared categories (`user_id IS NULL`) for income, expense and transfer replace
the old per-user seeding. They cover: Salary, Business, Freelance, Investment,
Bonus, Refund, Interest, Gift, Other Income, Food & Dining, Rent & Housing,
Transport, Fuel, Bills & Utilities, Healthcare, Shopping, Education, Travel,
Entertainment, Insurance, Taxes, Other Expense, Transfer.

## Frontend architecture

```
src/
  lib/constants.js     — account/asset/liability/goal metadata + icon names
  lib/utils.js         — money(), prettyDate(), csvDownload()
  stores/dataStore.js  — zustand store: all entities, offline queue, balance sync
  components/          — Modal, EntityIcon, TransactionForm, AppLayout, …
  pages/               — Dashboard, Accounts, Transactions, Budgets,
                         Goals, Net Worth, Reports, Notifications, Settings
```

`dataStore.js` exposes `fetchAll`, per-entity CRUD (`addAccount`, `addTransfer`,
`addAsset`, `addLiability`, `addGoal`, …), `saveBudget` (scope-aware) and the
offline `processQueue`. New tables are fetched with `Promise.allSettled` so a
missing table never bricks the app.

## Offline support (unchanged contract)

- Every mutation goes through a queue when offline (`localStorage` persisted).
- On reconnect `processQueue()` replays inserts/updates/deletes + transfer RPCs
  and then refetches canonical data.
