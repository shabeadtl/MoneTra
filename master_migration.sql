begin;

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  updated_at timestamptz not null default now(),
  full_name text not null default 'User',
  avatar_url text,
  currency text not null default 'INR' check (currency in ('INR', 'USD', 'EUR', 'GBP')),
  theme_preference text not null default 'light' check (theme_preference in ('light', 'dark')),
  email_notifications boolean not null default true
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  icon text not null default 'Circle',
  color text not null default '#64748B' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  unique (user_id, name)
);

create unique index if not exists categories_system_name_unique
  on public.categories (name) where user_id is null;

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete restrict,
  type text not null check (type in ('INCOME', 'EXPENSE')),
  title text not null check (char_length(trim(title)) between 1 and 120),
  amount numeric(12, 2) not null check (amount > 0),
  date date not null,
  notes text,
  is_recurring boolean not null default false
);

create index if not exists transactions_user_date_idx on public.transactions(user_id, date desc);
create index if not exists transactions_user_category_idx on public.transactions(user_id, category_id);

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  limit_amount numeric(12, 2) not null check (limit_amount > 0),
  month integer not null check (month between 1 and 12),
  year integer not null check (year between 2000 and 9999),
  unique (user_id, category_id, month, year)
);

create index if not exists budgets_user_period_idx on public.budgets(user_id, year, month);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('INFO', 'SUCCESS', 'WARNING', 'ERROR')),
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx on public.notifications(user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles for select to authenticated using (auth.uid() = id);
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Users can view available categories" on public.categories;
create policy "Users can view available categories" on public.categories for select to authenticated using (user_id is null or auth.uid() = user_id);
drop policy if exists "Users can create own categories" on public.categories;
create policy "Users can create own categories" on public.categories for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update own categories" on public.categories;
create policy "Users can update own categories" on public.categories for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete own categories" on public.categories;
create policy "Users can delete own categories" on public.categories for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Users can view own transactions" on public.transactions;
create policy "Users can view own transactions" on public.transactions for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can create own transactions" on public.transactions;
create policy "Users can create own transactions" on public.transactions for insert to authenticated with check (
  auth.uid() = user_id and exists (select 1 from public.categories c where c.id = category_id and (c.user_id is null or c.user_id = auth.uid()))
);
drop policy if exists "Users can update own transactions" on public.transactions;
create policy "Users can update own transactions" on public.transactions for update to authenticated using (auth.uid() = user_id) with check (
  auth.uid() = user_id and exists (select 1 from public.categories c where c.id = category_id and (c.user_id is null or c.user_id = auth.uid()))
);
drop policy if exists "Users can delete own transactions" on public.transactions;
create policy "Users can delete own transactions" on public.transactions for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Users can view own budgets" on public.budgets;
create policy "Users can view own budgets" on public.budgets for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can create own budgets" on public.budgets;
create policy "Users can create own budgets" on public.budgets for insert to authenticated with check (
  auth.uid() = user_id and exists (select 1 from public.categories c where c.id = category_id and (c.user_id is null or c.user_id = auth.uid()))
);
drop policy if exists "Users can update own budgets" on public.budgets;
create policy "Users can update own budgets" on public.budgets for update to authenticated using (auth.uid() = user_id) with check (
  auth.uid() = user_id and exists (select 1 from public.categories c where c.id = category_id and (c.user_id is null or c.user_id = auth.uid()))
);
drop policy if exists "Users can delete own budgets" on public.budgets;
create policy "Users can delete own budgets" on public.budgets for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Users can view own notifications" on public.notifications;
create policy "Users can view own notifications" on public.notifications for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can update own notifications" on public.notifications;
create policy "Users can update own notifications" on public.notifications for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete own notifications" on public.notifications;
create policy "Users can delete own notifications" on public.notifications for delete to authenticated using (auth.uid() = user_id);

create or replace function public.set_profile_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at before update on public.profiles
for each row execute function public.set_profile_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, currency, theme_preference)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 'User'), 'INR', 'light');

  insert into public.categories (user_id, name, icon, color) values
    (new.id, 'Food & Dining', 'Utensils', '#EF4444'),
    (new.id, 'Rent & Housing', 'Home', '#3B82F6'),
    (new.id, 'Transport', 'Car', '#F59E0B'),
    (new.id, 'Salary', 'Briefcase', '#10B981');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.check_budget_on_expense()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_total_spent numeric;
  v_budget_limit numeric;
  v_cat_name text;
begin
  if new.type = 'EXPENSE' then
    select c.name into v_cat_name from public.categories c where c.id = new.category_id;
    select b.limit_amount into v_budget_limit from public.budgets b
      where b.category_id = new.category_id
        and b.month = extract(month from new.date)::integer
        and b.year = extract(year from new.date)::integer
        and b.user_id = new.user_id;

    if v_budget_limit is not null then
      select coalesce(sum(t.amount), 0) into v_total_spent from public.transactions t
        where t.category_id = new.category_id
          and extract(month from t.date) = extract(month from new.date)
          and extract(year from t.date) = extract(year from new.date)
          and t.type = 'EXPENSE' and t.user_id = new.user_id;

      if v_total_spent >= v_budget_limit then
        insert into public.notifications (user_id, type, message)
        values (new.user_id, 'ERROR', 'Alert: Budget limit exceeded for category: ' || v_cat_name);
      elsif v_total_spent >= v_budget_limit * 0.8 then
        insert into public.notifications (user_id, type, message)
        values (new.user_id, 'WARNING', 'Warning: Spending has reached 80% of budget for category: ' || v_cat_name);
      end if;
    end if;
  elsif new.type = 'INCOME' then
    insert into public.notifications (user_id, type, message)
    values (new.user_id, 'SUCCESS', 'Income recorded successfully: Added ' || new.amount);
  end if;
  return new;
end;
$$;

drop trigger if exists on_transaction_inserted on public.transactions;
create trigger on_transaction_inserted after insert on public.transactions
for each row execute function public.check_budget_on_expense();

create or replace function public.get_admin_stats()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_is_staff boolean;
begin
  select coalesce((raw_app_meta_data ->> 'is_staff')::boolean, false) or raw_app_meta_data ->> 'role' = 'admin'
    into v_is_staff from auth.users where id = auth.uid();
  if not coalesce(v_is_staff, false) then raise exception 'Access denied'; end if;
  return jsonb_build_object(
    'users', (select count(*) from auth.users),
    'transactions', (select count(*) from public.transactions),
    'income', (select coalesce(sum(amount), 0) from public.transactions where type = 'INCOME'),
    'expenses', (select coalesce(sum(amount), 0) from public.transactions where type = 'EXPENSE'),
    'registrations', (select coalesce(jsonb_agg(x order by x.day), '[]'::jsonb) from (
      select date_trunc('day', created_at)::date as day, count(*) as count from auth.users
      where created_at >= now() - interval '30 days' group by 1
    ) x)
  );
end;
$$;
revoke all on function public.get_admin_stats() from public;
grant execute on function public.get_admin_stats() to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public avatar access" on storage.objects;
create policy "Public avatar access" on storage.objects for select using (bucket_id = 'avatars');
drop policy if exists "Users upload own avatars" on storage.objects;
create policy "Users upload own avatars" on storage.objects for insert to authenticated
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Users update own avatars" on storage.objects;
create policy "Users update own avatars" on storage.objects for update to authenticated
using (bucket_id = 'avatars' and owner_id = auth.uid()::text)
with check (bucket_id = 'avatars' and owner_id = auth.uid()::text);
drop policy if exists "Users delete own avatars" on storage.objects;
create policy "Users delete own avatars" on storage.objects for delete to authenticated
using (bucket_id = 'avatars' and owner_id = auth.uid()::text);

commit;
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
begin;

create or replace function public.check_budget_on_expense()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_rec record;
  v_budget record;
  v_total_spent numeric;
  v_name text;
begin
  if tg_op = 'DELETE' then
    v_rec := old;
  else
    v_rec := new;
  end if;

  if v_rec.type != 'EXPENSE' then
    if tg_op = 'INSERT' and v_rec.type = 'INCOME' then
      insert into public.notifications (user_id, type, message)
      values (v_rec.user_id, 'SUCCESS', 'Income recorded successfully: Added ' || v_rec.amount);
    end if;
    return coalesce(new, old);
  end if;

  -- Do not check budgets if we just deleted an expense
  if tg_op = 'DELETE' then
    return old;
  end if;

  -- Skip budget check if it's an update but amount did not increase, 
  -- and it didn't change category/account/date
  if tg_op = 'UPDATE' 
     and old.amount >= new.amount 
     and old.category_id = new.category_id 
     and old.account_id is not distinct from new.account_id 
     and old.date = new.date then
    return new;
  end if;

  -- Find all applicable budgets (CATEGORY, ACCOUNT, TOTAL)
  for v_budget in 
    select id, limit_amount, scope, category_id, account_id 
    from public.budgets
    where user_id = v_rec.user_id
      and month = extract(month from v_rec.date)::integer
      and year = extract(year from v_rec.date)::integer
      and (
        (scope = 'TOTAL') or
        (scope = 'CATEGORY' and category_id = v_rec.category_id) or
        (scope = 'ACCOUNT' and account_id = v_rec.account_id)
      )
  loop
    if v_budget.scope = 'TOTAL' then
      select coalesce(sum(amount), 0) into v_total_spent from public.transactions
      where user_id = v_rec.user_id and type = 'EXPENSE'
        and extract(month from date) = extract(month from v_rec.date)
        and extract(year from date) = extract(year from v_rec.date);
      v_name := 'Overall Budget';
    elsif v_budget.scope = 'CATEGORY' then
      select coalesce(sum(amount), 0) into v_total_spent from public.transactions
      where user_id = v_rec.user_id and category_id = v_budget.category_id and type = 'EXPENSE'
        and extract(month from date) = extract(month from v_rec.date)
        and extract(year from date) = extract(year from v_rec.date);
      select name into v_name from public.categories where id = v_budget.category_id;
      v_name := 'Category: ' || coalesce(v_name, 'Unknown');
    elsif v_budget.scope = 'ACCOUNT' then
      select coalesce(sum(amount), 0) into v_total_spent from public.transactions
      where user_id = v_rec.user_id and account_id = v_budget.account_id and type = 'EXPENSE'
        and extract(month from date) = extract(month from v_rec.date)
        and extract(year from date) = extract(year from v_rec.date);
      select name into v_name from public.accounts where id = v_budget.account_id;
      v_name := 'Account: ' || coalesce(v_name, 'Unknown');
    end if;

    -- Evaluate thresholds
    if v_total_spent >= v_budget.limit_amount then
      insert into public.notifications (user_id, type, message)
      values (v_rec.user_id, 'ERROR', 'Alert: Budget limit exceeded for ' || v_name);
    elsif v_total_spent >= v_budget.limit_amount * 0.8 then
      insert into public.notifications (user_id, type, message)
      values (v_rec.user_id, 'WARNING', 'Warning: Spending has reached 80% of budget for ' || v_name);
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists on_transaction_inserted on public.transactions;
drop trigger if exists check_budget_on_expense_trigger on public.transactions;

create trigger check_budget_on_expense_trigger 
after insert or update or delete on public.transactions
for each row execute function public.check_budget_on_expense();

commit;
begin;

-- 1. Support category archiving
alter table public.categories add column if not exists is_archived boolean not null default false;

-- 2. Support transfer editing
create or replace function public.update_transfer(
  p_transfer_id uuid,
  p_user_id uuid,
  p_source_account_id uuid,
  p_destination_account_id uuid,
  p_amount numeric,
  p_date date,
  p_description text
) returns void language plpgsql security definer set search_path = '' as $$
declare
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
  if not exists (select 1 from public.transfers where id = p_transfer_id and user_id = p_user_id) then
    raise exception 'Transfer not found';
  end if;

  select name into v_source from public.accounts where id = p_source_account_id;
  select name into v_dest   from public.accounts where id = p_destination_account_id;

  -- Update the transfer record itself
  update public.transfers
  set source_account_id = p_source_account_id,
      destination_account_id = p_destination_account_id,
      amount = p_amount,
      date = p_date,
      description = p_description
  where id = p_transfer_id and user_id = p_user_id;

  -- Update the outgoing (EXPENSE) leg
  update public.transactions
  set account_id = p_source_account_id,
      amount = p_amount,
      date = p_date,
      title = 'Transfer to ' || v_dest,
      notes = p_description
  where transfer_id = p_transfer_id and type = 'EXPENSE' and user_id = p_user_id;

  -- Update the incoming (INCOME) leg
  update public.transactions
  set account_id = p_destination_account_id,
      amount = p_amount,
      date = p_date,
      title = 'Transfer from ' || v_source,
      notes = p_description
  where transfer_id = p_transfer_id and type = 'INCOME' and user_id = p_user_id;

end;
$$;

revoke all on function public.update_transfer(uuid, uuid, uuid, uuid, numeric, date, text) from public;
grant execute on function public.update_transfer(uuid, uuid, uuid, uuid, numeric, date, text) to authenticated;

commit;
begin;

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
  if auth.uid() != p_user_id then
    raise exception 'Unauthorized';
  end if;

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


create or replace function public.update_transfer(
  p_transfer_id uuid,
  p_user_id uuid,
  p_source_account_id uuid,
  p_destination_account_id uuid,
  p_amount numeric,
  p_date date,
  p_description text
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_source text;
  v_dest text;
begin
  if auth.uid() != p_user_id then
    raise exception 'Unauthorized';
  end if;

  if p_source_account_id = p_destination_account_id then
    raise exception 'Source and destination accounts must be different';
  end if;
  if not exists (select 1 from public.accounts where id = p_source_account_id and user_id = p_user_id) then
    raise exception 'Source account not found';
  end if;
  if not exists (select 1 from public.accounts where id = p_destination_account_id and user_id = p_user_id) then
    raise exception 'Destination account not found';
  end if;
  if not exists (select 1 from public.transfers where id = p_transfer_id and user_id = p_user_id) then
    raise exception 'Transfer not found';
  end if;

  select name into v_source from public.accounts where id = p_source_account_id;
  select name into v_dest   from public.accounts where id = p_destination_account_id;

  -- Update the transfer record itself
  update public.transfers
  set source_account_id = p_source_account_id,
      destination_account_id = p_destination_account_id,
      amount = p_amount,
      date = p_date,
      description = p_description
  where id = p_transfer_id and user_id = p_user_id;

  -- Update the outgoing (EXPENSE) leg
  update public.transactions
  set account_id = p_source_account_id,
      amount = p_amount,
      date = p_date,
      title = 'Transfer to ' || v_dest,
      notes = p_description
  where transfer_id = p_transfer_id and type = 'EXPENSE' and user_id = p_user_id;

  -- Update the incoming (INCOME) leg
  update public.transactions
  set account_id = p_destination_account_id,
      amount = p_amount,
      date = p_date,
      title = 'Transfer from ' || v_source,
      notes = p_description
  where transfer_id = p_transfer_id and type = 'INCOME' and user_id = p_user_id;

end;
$$;

commit;

NOTIFY pgrst, 'reload schema';
