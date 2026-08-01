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
