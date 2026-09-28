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
