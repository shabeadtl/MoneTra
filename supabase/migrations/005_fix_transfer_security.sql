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
