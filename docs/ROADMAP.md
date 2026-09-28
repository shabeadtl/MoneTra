# Monetra — Migration Strategy, Risks & Roadmap

## Migration strategy

1. **`001_initial_schema.sql`** — untouched (already applied to every
   environment). No data is rewritten, dropped or reordered.
2. **`002_money_platform.sql`** — purely additive:
   - `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` on `categories`,
     `transactions`, `budgets`.
   - `CREATE TABLE IF NOT EXISTS` for the five new tables.
   - `CREATE OR REPLACE FUNCTION` for triggers/RPCs (idempotent).
   - Existing user-created categories keep working; shared system categories
     are inserted with `ON CONFLICT ... DO NOTHING`.

   Because every statement is idempotent, the migration can be re-run safely.

### Deploying to Supabase

```bash
supabase link --project-ref <ref>
supabase db push          # applies 001 (already there) + 002
# or run the file directly in the SQL editor
```

## Risk assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| New tables missing in a deployed project | pages show empty data | `Promise.allSettled` fetch; app keeps working |
| Old INCOME user categories default to `category_type = 'EXPENSE'` | wrong filter | new system categories are the primary source; user categories without type appear in both lists |
| Transfer legs counted twice in totals | wrong dashboard sums | transfers are income/expense legs — they net to zero in "balance" math |
| Account balance drift after edits | wrong balances | trigger + client-side `recomputeBalances()` recompute from source |
| Offline queue ordering (transfer after account creation) | sync failures | queue replays in order; failed actions are retried |
| Cloudflare free-plan function quota | cost | `_routes.json` keeps static assets off the Function path |

## Implementation plan (done in this pass)

1. ✅ Migration `002` — tables, triggers, RPC, RLS, system categories
2. ✅ `constants.js` + `dataStore.js` — metadata + unified store with offline queue
3. ✅ `TransactionForm` — account selector + type-filtered categories
4. ✅ `AccountsPage` — account CRUD + transfer modal
5. ✅ `GoalsPage` — goal CRUD, quick contributions, deadlines
6. ✅ `NetWorthPage` — assets + liabilities CRUD, net-worth hero
7. ✅ `ReportsPage` — daily/weekly/monthly/yearly charts
8. ✅ Dashboard (net-worth banner + accounts strip), Transactions (account
    filter/column), Budgets (category/account/overall scope)
9. ✅ Routes + navigation (desktop sidebar + mobile "More" menu)
10. ✅ Docs + validation (lint, tests, build, review)

## Development roadmap

- **v2.1** — Goals funded automatically from a chosen account; budget vs actual
  on the dashboard; export CSV for reports.
- **v2.2** — Attachments on transactions; recurring transaction auto-entry;
  transfer category picker.
- **v2.3** — Yearly budget rollover; multi-currency conversion previews;
  liability payoff planner (extra-payment sim).
- **v2.4** — Cash-flow forecast; smart insights ("you spend X more on weekends");
  export to PDF.

Each step keeps the same architecture: additive migrations, store-backed state,
offline-first writes.
