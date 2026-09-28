-- ============================================================================
-- 002_money_platform.sql — Transform Monetra from expense tracker to a
-- complete personal money management platform.
-- Backwards compatible: preserves all existing tables, data and features.
-- ============================================================================
begin;

-- ----------------------------------------------------------------------------
-- 1. CATEGORIES — add a type dimension + system (shared) categories
-- ----------------------------------------------------------------------------
alter table public.categories
  add column if not exists category_type text not null default 'EXPENSE'
  check (category_type in ('INCOME', 'EXPENSE', 'TRANSFER'));

alter table public.categories
  add column if not exists is_system boolean not null default false;

-- Shared categories (user_id null) visible to every user. New users no longer
-- get per-user duplicates — these cover income, expense and transfers.
insert into public.categories (user_id, name, icon, color, category_type, is_system) values
  (null, 'Transfer',         'ArrowLeftRight', '#0D9488', 'TRANSFER', true),
  -- Income
  (null, 'Salary',           'Briefcase',      '#10B981', 'INCOME',   true),
  (null, 'Business',         'Store',          '#14B8A6', 'INCOME',   true),
  (null, 'Freelance',        'Laptop',         '#22C55E', 'INCOME',   true),
  (null, 'Investment',       'TrendingUp',     '#3B82F6', 'INCOME',   true),
  (null, 'Bonus',            'Gift',           '#F59E0B', 'INCOME',   true),
  (null, 'Refund',           'RotateCcw',      '#8B5CF6', 'INCOME',   true),
  (null, 'Interest',         'Percent',        '#6366F1', 'INCOME',   true),
  (null, 'Gift',             'Gift',           '#EC4899', 'INCOME',   true),
  (null, 'Other Income',     'Plus',           '#64748B', 'INCOME',   true),
  -- Expenses
  (null, 'Food & Dining',    'Utensils',       '#EF4444', 'EXPENSE',  true),
  (null, 'Rent & Housing',   'Home',           '#3B82F6', 'EXPENSE',  true),
  (null, 'Transport',        'Car',            '#F59E0B', 'EXPENSE',  true),
  (null, 'Fuel',             'Fuel',           '#F97316', 'EXPENSE',  true),
  (null, 'Bills & Utilities','Receipt',        '#06B6D4', 'EXPENSE',  true),
  (null, 'Healthcare',       'HeartPulse',     '#EF4444', 'EXPENSE',  true),
  (null, 'Shopping',         'ShoppingBag',    '#EC4899', 'EXPENSE',  true),
  (null, 'Education',        'GraduationCap',  '#8B5CF6', 'EXPENSE',  true),
  (null, 'Travel',           'Plane',          '#0EA5E9', 'EXPENSE',  true),
  (null, 'Entertainment',    'Clapperboard',   '#F43F5E', 'EXPENSE',  true),
  (null, 'Insurance',        'Shield',         '#64748B', 'EXPENSE',  true),
  (null, 'Taxes',            'Landmark',       '#78716C', 'EXPENSE',  true),
  (null, 'Other Expense',    'Ellipsis',       '#64748B', 'EXPENSE',  true)
on conflict (name) where user_id is null do nothing;

-- Backfill legacy per-user categories: type them by matching system category
-- names, so pre-existing income categories (Salary, Bonus, …) don't fall into
-- the new column's EXPENSE default and vanish from income dropdowns.
update public.categories c
set category_type = s.category_type
from (select lower(name) as n, category_type from public.categories where user_id is null) s
where c.user_id is not null and lower(c.name) = s.n;

-- ----------------------------------------------------------------------------
-- 2. ACCOUNTS — where money lives (cash, bank, cards, wallets, …)
-- ----------------------------------------------------------------------------
create table if not exists public.accounts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  name             text not null check (char_length(trim(name)) between 1 and 60),
  account_type     text not null default 'CASH' check (account_type in
                     ('CASH', 'SAVINGS', 'CURRENT', 'CREDIT_CARD', 'LOAN',
                      'INVESTMENT', 'DIGITAL_WALLET', 'BUSINESS', 'OTHER')),
  institution_name text,
  account_number   text,
  currency         text not null default 'INR' check (currency in ('INR', 'USD', 'EUR', 'GBP')),
  balance          numeric(14, 2) not null default 0,
  opening_balance  numeric(14, 2) not null default 0,
  opening_date     date not null default current_date,
  is_archived      boolean not null default false,
  color            text not null default '#0D9488' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  icon             text not null default 'Wallet',
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists accounts_user_idx on public.accounts(user_id, sort_order);
alter table public.accounts enable row level security;

-- ----------------------------------------------------------------------------
-- 3. TRANSFERS — money moved between the user's own accounts
-- ----------------------------------------------------------------------------
create table if not exists public.transfers (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users(id) on delete cascade,
  source_account_id      uuid not null references public.accounts(id) on delete restrict,
  destination_account_id uuid not null references public.accounts(id) on delete restrict,
  amount                 numeric(12, 2) not null check (amount > 0),
  date                   date not null,
  description            text,
  created_at             timestamptz not null default now(),
  check (source_account_id <> destination_account_id)
);

create index if not exists transfers_user_date_idx on public.transfers(user_id, date desc);
alter table public.transfers enable row level security;

-- ----------------------------------------------------------------------------
-- 4. TRANSACTIONS — attach to accounts + transfers (keeps every existing row)
-- ----------------------------------------------------------------------------
alter table public.transactions
  add column if not exists account_id uuid references public.accounts(id) on delete set null;

alter table public.transactions
  add column if not exists transfer_id uuid references public.transfers(id) on delete cascade;

create index if not exists transactions_account_idx on public.transactions(account_id);

-- ----------------------------------------------------------------------------
-- 5. BUDGETS — support account-level and overall (total) budgets
-- ----------------------------------------------------------------------------
alter table public.budgets
  add column if not exists scope text not null default 'CATEGORY'
  check (scope in ('CATEGORY', 'ACCOUNT', 'TOTAL'));

alter table public.budgets
  add column if not exists account_id uuid references public.accounts(id) on delete cascade;

alter table public.budgets alter column category_id drop not null;

create index if not exists budgets_account_idx on public.budgets(account_id);

-- ----------------------------------------------------------------------------
-- 6. ASSETS — gold, stocks, crypto, real estate, mutual funds, FDs, …
-- ----------------------------------------------------------------------------
create table if not exists public.assets (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  name           text not null check (char_length(trim(name)) between 1 and 80),
  asset_type     text not null default 'OTHER' check (asset_type in
                   ('GOLD', 'STOCKS', 'CRYPTOCURRENCY', 'REAL_ESTATE',
                    'MUTUAL_FUNDS', 'FIXED_DEPOSIT', 'OTHER')),
  purchase_price numeric(14, 2) not null default 0,
  quantity       numeric(16, 6) not null default 1,
  purchase_date  date,
  current_value  numeric(14, 2) not null default 0,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists assets_user_idx on public.assets(user_id);
alter table public.assets enable row level security;

-- ----------------------------------------------------------------------------
-- 7. LIABILITIES — credit cards, loans, debts, EMI
-- ----------------------------------------------------------------------------
create table if not exists public.liabilities (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  name             text not null check (char_length(trim(name)) between 1 and 80),
  liability_type   text not null default 'LOAN' check (liability_type in
                     ('CREDIT_CARD', 'LOAN', 'DEBT', 'EMI', 'MORTGAGE', 'OTHER')),
  amount           numeric(14, 2) not null default 0,
  interest_rate    numeric(6, 2)  not null default 0,
  start_date       date,
  end_date         date,
  monthly_payment  numeric(14, 2) not null default 0,
  remaining_balance numeric(14, 2) not null default 0,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists liabilities_user_idx on public.liabilities(user_id);
alter table public.liabilities enable row level security;

-- ----------------------------------------------------------------------------
-- 8. GOALS — savings targets (emergency fund, bike, house, …)
-- ----------------------------------------------------------------------------
create table if not exists public.goals (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  name           text not null check (char_length(trim(name)) between 1 and 80),
  target_amount  numeric(14, 2) not null check (target_amount > 0),
  saved_amount   numeric(14, 2) not null default 0,
  deadline       date,
  priority       text not null default 'MEDIUM' check (priority in ('LOW', 'MEDIUM', 'HIGH')),
  icon           text not null default 'Target',
  color          text not null default '#0D9488' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  is_archived    boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists goals_user_idx on public.goals(user_id);
alter table public.goals enable row level security;

-- ----------------------------------------------------------------------------
-- 9. Balance maintenance — opening balance + income − expenses (+ transfers)
-- ----------------------------------------------------------------------------
create or replace function public.apply_transaction_to_accounts()
returns trigger language plpgsql set search_path = '' as $$
begin
  -- Revert the previously stored row (DELETE or UPDATE)
  if tg_op = 'DELETE' then
    if old.account_id is not null then
      update public.accounts set balance = balance - (case when old.type = 'INCOME' then old.amount else -old.amount end)
      where id = old.account_id;
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' and old.account_id is not null then
    update public.accounts set balance = balance - (case when old.type = 'INCOME' then old.amount else -old.amount end)
    where id = old.account_id;
  end if;

  -- Apply the new row (INSERT or UPDATE)
  if new.account_id is not null then
    update public.accounts set balance = balance + (case when new.type = 'INCOME' then new.amount else -new.amount end)
    where id = new.account_id;
  end if;

  return new;
end;
$$;

drop trigger if exists apply_transaction_to_accounts on public.transactions;
create trigger apply_transaction_to_accounts
after insert or update or delete on public.transactions
for each row execute function public.apply_transaction_to_accounts();

-- ----------------------------------------------------------------------------
-- 10. Atomic transfer RPC — one call creates the transfer + both legs
-- ----------------------------------------------------------------------------
create or replace function public.create_transfer(
  p_user_id uuid,
  p_source_account_id uuid,
  p_destination_account_id uuid,
  p_amount numeric,
  p_date date,
  p_description text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_transfer_id uuid;
  v_cat uuid;
  v_source text;
  v_dest text;
begin
  if p_source_account_id = p_destination_account_id then
    raise exception 'Source and destination accounts must be different';
  end if;
  if not exists (select 1 from public.accounts where id = p_source_account_id and user_id = p_user_id) then
    raise exception 'Source account not found';
  end if;
  if not exists (select 1 from public.accounts where id = p_destination_account_id and user_id = p_user_id) then
    raise exception 'Destination account not found';
  end if;

  select id into v_cat from public.categories where name = 'Transfer' and user_id is null limit 1;
  if v_cat is null then
    v_cat := gen_random_uuid();
    insert into public.categories (id, user_id, name, icon, color, category_type)
    values (v_cat, p_user_id, 'Transfer', 'ArrowLeftRight', '#0D9488', 'TRANSFER');
  end if;

  select name into v_source from public.accounts where id = p_source_account_id;
  select name into v_dest   from public.accounts where id = p_destination_account_id;

  insert into public.transfers (user_id, source_account_id, destination_account_id, amount, date, description)
  values (p_user_id, p_source_account_id, p_destination_account_id, p_amount, p_date, p_description)
  returning id into v_transfer_id;

  insert into public.transactions (user_id, category_id, type, title, amount, date, notes, account_id, transfer_id)
  values
    (p_user_id, v_cat, 'EXPENSE', 'Transfer to ' || v_dest,   p_amount, p_date, p_description, p_source_account_id,      v_transfer_id),
    (p_user_id, v_cat, 'INCOME',  'Transfer from ' || v_source, p_amount, p_date, p_description, p_destination_account_id, v_transfer_id);

  return v_transfer_id;
end;
$$;

revoke all on function public.create_transfer(uuid, uuid, uuid, numeric, date, text) from public;
grant execute on function public.create_transfer(uuid, uuid, uuid, numeric, date, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 11. RLS policies — new tables
-- ----------------------------------------------------------------------------
drop policy if exists "Users can view own accounts" on public.accounts;
create policy "Users can view own accounts" on public.accounts for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can create own accounts" on public.accounts;
create policy "Users can create own accounts" on public.accounts for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update own accounts" on public.accounts;
create policy "Users can update own accounts" on public.accounts for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete own accounts" on public.accounts;
create policy "Users can delete own accounts" on public.accounts for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Users can view own transfers" on public.transfers;
create policy "Users can view own transfers" on public.transfers for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can create own transfers" on public.transfers;
create policy "Users can create own transfers" on public.transfers for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update own transfers" on public.transfers;
create policy "Users can update own transfers" on public.transfers for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete own transfers" on public.transfers;
create policy "Users can delete own transfers" on public.transfers for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Users can view own assets" on public.assets;
create policy "Users can view own assets" on public.assets for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can create own assets" on public.assets;
create policy "Users can create own assets" on public.assets for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update own assets" on public.assets;
create policy "Users can update own assets" on public.assets for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete own assets" on public.assets;
create policy "Users can delete own assets" on public.assets for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Users can view own liabilities" on public.liabilities;
create policy "Users can view own liabilities" on public.liabilities for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can create own liabilities" on public.liabilities;
create policy "Users can create own liabilities" on public.liabilities for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update own liabilities" on public.liabilities;
create policy "Users can update own liabilities" on public.liabilities for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete own liabilities" on public.liabilities;
create policy "Users can delete own liabilities" on public.liabilities for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Users can view own goals" on public.goals;
create policy "Users can view own goals" on public.goals for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can create own goals" on public.goals;
create policy "Users can create own goals" on public.goals for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update own goals" on public.goals;
create policy "Users can update own goals" on public.goals for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete own goals" on public.goals;
create policy "Users can delete own goals" on public.goals for delete to authenticated using (auth.uid() = user_id);

-- Tighten transaction policies: only allow linking the user's own accounts
drop policy if exists "Users can create own transactions" on public.transactions;
create policy "Users can create own transactions" on public.transactions for insert to authenticated with check (
  auth.uid() = user_id
  and exists (select 1 from public.categories c where c.id = category_id and (c.user_id is null or c.user_id = auth.uid()))
  and (account_id is null or exists (select 1 from public.accounts a where a.id = account_id and a.user_id = auth.uid()))
);
drop policy if exists "Users can update own transactions" on public.transactions;
create policy "Users can update own transactions" on public.transactions for update to authenticated using (auth.uid() = user_id) with check (
  auth.uid() = user_id
  and exists (select 1 from public.categories c where c.id = category_id and (c.user_id is null or c.user_id = auth.uid()))
  and (account_id is null or exists (select 1 from public.accounts a where a.id = account_id and a.user_id = auth.uid()))
);

-- ----------------------------------------------------------------------------
-- 12. Updated_at maintenance for new tables
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_accounts_updated_at on public.accounts;
create trigger set_accounts_updated_at before update on public.accounts
for each row execute function public.set_updated_at();
drop trigger if exists set_assets_updated_at on public.assets;
create trigger set_assets_updated_at before update on public.assets
for each row execute function public.set_updated_at();
drop trigger if exists set_liabilities_updated_at on public.liabilities;
create trigger set_liabilities_updated_at before update on public.liabilities
for each row execute function public.set_updated_at();
drop trigger if exists set_goals_updated_at on public.goals;
create trigger set_goals_updated_at before update on public.goals
for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 13. New users start with a Cash account + the shared system categories
--     (per-user category seeding replaced — system categories cover them all)
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, currency, theme_preference)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 'User'), 'INR', 'light');

  insert into public.accounts (user_id, name, account_type, icon, color)
  values (new.id, 'Cash Wallet', 'CASH', 'Wallet', '#0D9488');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

commit;
