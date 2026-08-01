-- Run in a disposable Supabase project after 001_initial_schema.sql.
-- The checks below should return true. Replace UUIDs with two test auth users.
select relname, relrowsecurity
from pg_class
where relnamespace = 'public'::regnamespace
  and relname in ('profiles', 'categories', 'transactions', 'budgets', 'notifications');

select tablename, policyname, cmd
from pg_policies
where schemaname in ('public', 'storage')
order by tablename, policyname;

select tgname, tgrelid::regclass
from pg_trigger
where tgname in ('on_auth_user_created', 'on_transaction_inserted', 'set_profiles_updated_at');

-- Tenant isolation manual test:
-- 1. Set request.jwt.claim.sub to user A and insert/read a transaction for user A.
-- 2. Set it to user B and verify user A's row is neither selectable nor mutable.
-- 3. Insert expenses below 80%, at 80%, and at 100% of a budget; verify WARNING/ERROR rows.
