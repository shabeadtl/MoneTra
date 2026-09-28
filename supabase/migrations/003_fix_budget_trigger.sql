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
