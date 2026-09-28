import { create } from 'zustand';
import { requireSupabase } from '../lib/supabase';

const QUEUE_KEY = 'monetra_offline_queue';
const CACHE_KEY = 'monetra_data_cache';
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const persistQueue = (queue) => localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));

// Recompute every account's balance from opening balance + its transactions.
// Balance = opening_balance + income − expenses (transfers are income/expense legs).
function recomputeBalances(accounts, transactions) {
  return accounts.map((acc) => {
    const bal = transactions
      .filter((t) => t.account_id === acc.id)
      .reduce((sum, t) => sum + (t.type === 'INCOME' ? Number(t.amount) : -Number(t.amount)), Number(acc.opening_balance || 0));
    return bal === Number(acc.balance) ? acc : { ...acc, balance: bal };
  });
}

// Show user-created categories first so they win over shared system categories
// with the same name (avoids duplicates in dropdowns).
function dedupeCategories(categories) {
  const seen = new Set();
  const out = [];
  for (const c of [...categories].sort((a, b) => (a.user_id ? 0 : 1) - (b.user_id ? 0 : 1))) {
    const key = (c.name || '').toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

const cached = read(CACHE_KEY, {});

export const useDataStore = create((set, get) => ({
  /* ── State ─────────────────────────────────────────────────────────── */
  transactions: cached.transactions || [],
  categories: cached.categories || [],
  budgets: cached.budgets || [],
  notifications: cached.notifications || [],
  accounts: cached.accounts || [],
  transfers: cached.transfers || [],
  assets: cached.assets || [],
  liabilities: cached.liabilities || [],
  goals: cached.goals || [],
  syncQueue: read(QUEUE_KEY, []),
  loading: false,
  syncing: false,
  error: null,

  cache: () => {
    const s = get();
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      transactions: s.transactions, categories: s.categories, budgets: s.budgets,
      notifications: s.notifications, accounts: s.accounts, transfers: s.transfers,
      assets: s.assets, liabilities: s.liabilities, goals: s.goals,
    }));
  },

  /* ── Fetch everything (tolerant: missing tables don't break the app) ── */
  fetchAll: async () => {
    if (!navigator.onLine) return;
    set({ loading: true, error: null });
    const client = requireSupabase();
    const [tx, cats, budgets, notes, accounts, transfers, assets, liabilities, goals] = await Promise.allSettled([
      client.from('transactions').select('*, categories(name, icon, color), accounts(name, color, icon)').order('date', { ascending: false }),
      client.from('categories').select('*').order('name'),
      client.from('budgets').select('*, categories(name, icon, color)').order('year', { ascending: false }),
      client.from('notifications').select('*').order('created_at', { ascending: false }),
      client.from('accounts').select('*').order('sort_order'),
      client.from('transfers').select('*').order('date', { ascending: false }),
      client.from('assets').select('*').order('created_at', { ascending: false }),
      client.from('liabilities').select('*').order('created_at', { ascending: false }),
      client.from('goals').select('*').order('created_at', { ascending: false }),
    ]);
    const ok = (r) => r.status === 'fulfilled' && !r.value.error;
    const firstError = [...tx, cats, budgets, notes, accounts, transfers, assets, liabilities, goals]
      .find((r) => r.status === 'fulfilled' && r.value.error);
    if (firstError) set({ error: firstError.value.error.message });
    set({
      transactions: ok(tx) ? tx.value.data : get().transactions,
      categories: ok(cats) ? dedupeCategories(cats.value.data) : get().categories,
      budgets: ok(budgets) ? budgets.value.data : get().budgets,
      notifications: ok(notes) ? notes.value.data : get().notifications,
      accounts: ok(accounts) ? accounts.value.data : get().accounts,
      transfers: ok(transfers) ? transfers.value.data : get().transfers,
      assets: ok(assets) ? assets.value.data : get().assets,
      liabilities: ok(liabilities) ? liabilities.value.data : get().liabilities,
      goals: ok(goals) ? goals.value.data : get().goals,
      loading: false,
    });
    get().cache();
  },

  /* ── Transactions (balance-aware) ───────────────────────────────────── */
  applyTransactions: (list) => {
    set({ transactions: list, accounts: recomputeBalances(get().accounts, list) });
    get().cache();
  },

  addTransaction: async (payload) => {
    if (!navigator.onLine) {
      const category = get().categories.find((c) => c.id === payload.category_id);
      const account = get().accounts.find((a) => a.id === payload.account_id);
      const pending = { ...payload, id: crypto.randomUUID(), local_only: true, categories: category, accounts: account };
      const action = { id: crypto.randomUUID(), operation: 'insert', table: 'transactions', payload: { ...payload, id: pending.id } };
      const queue = [...get().syncQueue, action];
      get().applyTransactions([pending, ...get().transactions]);
      set({ syncQueue: queue }); persistQueue(queue); return pending;
    }
    const { data, error } = await requireSupabase()
      .from('transactions').insert(payload)
      .select('*, categories(name, icon, color), accounts(name, color, icon)').single();
    if (error) throw error;
    get().applyTransactions([data, ...get().transactions]);
    return data;
  },

  updateTransaction: async (id, payload) => {
    if (!navigator.onLine) {
      const tx = get().transactions.find((x) => x.id === id);
      if (tx?.local_only) {
        const queue = get().syncQueue.map((a) =>
          a.operation === 'insert' && a.payload.id === id ? { ...a, payload: { ...a.payload, ...payload } } : a
        );
        get().applyTransactions(get().transactions.map((x) => (x.id === id ? { ...x, ...payload } : x)));
        set({ syncQueue: queue }); persistQueue(queue); return;
      }
      const action = { id: crypto.randomUUID(), operation: 'update', table: 'transactions', rowId: id, payload };
      const queue = [...get().syncQueue, action];
      get().applyTransactions(get().transactions.map((x) => (x.id === id ? { ...x, ...payload } : x)));
      set({ syncQueue: queue }); persistQueue(queue); return;
    }
    const { data, error } = await requireSupabase()
      .from('transactions').update(payload).eq('id', id)
      .select('*, categories(name, icon, color), accounts(name, color, icon)').single();
    if (error) throw error;
    get().applyTransactions(get().transactions.map((x) => (x.id === id ? data : x)));
  },

  deleteTransaction: async (id) => {
    const tx = get().transactions.find((x) => x.id === id);
    if (tx?.local_only) {
      const queue = get().syncQueue.filter((x) => x.payload.id !== id);
      get().applyTransactions(get().transactions.filter((x) => x.id !== id));
      set({ syncQueue: queue }); persistQueue(queue); return;
    }
    if (!navigator.onLine) {
      const action = { id: crypto.randomUUID(), operation: 'delete', table: 'transactions', rowId: id };
      const queue = [...get().syncQueue.filter((a) => !(a.operation === 'update' && a.rowId === id)), action];
      get().applyTransactions(get().transactions.filter((x) => x.id !== id));
      set({ syncQueue: queue }); persistQueue(queue); return;
    }
    const { error } = await requireSupabase().from('transactions').delete().eq('id', id);
    if (error) throw error;
    get().applyTransactions(get().transactions.filter((x) => x.id !== id));
  },

  /* ── Transfers (atomic via the create_transfer RPC) ─────────────────── */
  addTransfer: async (payload) => {
    if (!navigator.onLine) {
      const src = get().accounts.find((a) => a.id === payload.source_account_id);
      const dst = get().accounts.find((a) => a.id === payload.destination_account_id);
      const cat = get().categories.find((c) => c.name === 'Transfer') || get().categories[0];
      const transferId = crypto.randomUUID();
      const legs = [
        { ...payload, id: crypto.randomUUID(), local_only: true, transfer_id: transferId, type: 'EXPENSE', title: `Transfer to ${dst?.name || 'account'}`, category_id: cat?.id, account_id: payload.p_source_account_id, amount: payload.p_amount, date: payload.p_date, notes: payload.p_description || null },
        { ...payload, id: crypto.randomUUID(), local_only: true, transfer_id: transferId, type: 'INCOME', title: `Transfer from ${src?.name || 'account'}`, category_id: cat?.id, account_id: payload.p_destination_account_id, amount: payload.p_amount, date: payload.p_date, notes: payload.p_description || null },
      ];
      const pending = { id: transferId, ...payload, local_only: true };
      const action = { id: crypto.randomUUID(), operation: 'rpc', fn: 'create_transfer', payload };
      const queue = [...get().syncQueue, action];
      get().applyTransactions([...legs, ...get().transactions]);
      set({ transfers: [pending, ...get().transfers], syncQueue: queue }); persistQueue(queue); get().cache();
      return pending;
    }
    const { error } = await requireSupabase().rpc('create_transfer', payload);
    if (error) throw error;
    await get().fetchAll(); // pulls canonical transfer + both legs + fresh balances
  },

  updateTransfer: async (id, payload) => {
    if (!navigator.onLine) {
      const pending = { ...payload, id };
      const action = { id: crypto.randomUUID(), operation: 'rpc', fn: 'update_transfer', payload: { p_transfer_id: id, ...payload } };
      const queue = [...get().syncQueue, action];
      set({ transfers: get().transfers.map((x) => (x.id === id ? pending : x)), syncQueue: queue }); persistQueue(queue); get().cache();
      return pending;
    }
    const { error } = await requireSupabase().rpc('update_transfer', { p_transfer_id: id, ...payload });
    if (error) throw error;
    await get().fetchAll();
  },

  deleteTransfer: async (id) => {
    if (!navigator.onLine) {
      const action = { id: crypto.randomUUID(), operation: 'delete', table: 'transfers', rowId: id };
      const queue = [...get().syncQueue, action];
      set({ transfers: get().transfers.filter((x) => x.id !== id), syncQueue: queue });
      get().applyTransactions(get().transactions.filter((x) => x.transfer_id !== id));
      persistQueue(queue); get().cache(); return;
    }
    const { error } = await requireSupabase().from('transfers').delete().eq('id', id);
    if (error) throw error;
    set({ transfers: get().transfers.filter((x) => x.id !== id) });
    get().applyTransactions(get().transactions.filter((x) => x.transfer_id !== id));
    get().cache();
  },

  /* ── Generic entity mutations (accounts/assets/liabilities/goals) ───── */
  mutateEntity: async (table, listKey, { id, payload }) => {
    const list = get()[listKey];
    const persist = (rows) => { set({ [listKey]: rows }); get().cache(); };
    if (!navigator.onLine) {
      if (!id) {
        const row = { ...payload, id: crypto.randomUUID(), local_only: true };
        const queue = [...get().syncQueue, { id: crypto.randomUUID(), operation: 'insert', table, payload: { ...payload, id: row.id } }];
        persist([...list, row]); set({ syncQueue: queue }); persistQueue(queue); return row;
      }
      const row = { ...payload, id };
      const queue = [...get().syncQueue, { id: crypto.randomUUID(), operation: 'update', table, rowId: id, payload }];
      persist(list.map((x) => (x.id === id ? { ...x, ...payload } : x)));
      set({ syncQueue: queue }); persistQueue(queue); return row;
    }
    if (!id) {
      const { data, error } = await requireSupabase().from(table).insert(payload).select().single();
      if (error) throw error;
      persist([...list, data]); return data;
    }
    const { data, error } = await requireSupabase().from(table).update(payload).eq('id', id).select().single();
    if (error) throw error;
    persist(list.map((x) => (x.id === id ? data : x))); return data;
  },

  deleteEntity: async (table, listKey, id) => {
    const list = get()[listKey];
    const isLocal = list.find((x) => x.id === id)?.local_only;
    if (!navigator.onLine) {
      if (isLocal) {
        const queue = get().syncQueue.filter((a) => !(a.table === table && a.payload?.id === id));
        set({ [listKey]: list.filter((x) => x.id !== id), syncQueue: queue }); persistQueue(queue); get().cache(); return;
      }
      const queue = [...get().syncQueue.filter((a) => !(a.table === table && (a.rowId === id || a.payload?.id === id))),
        { id: crypto.randomUUID(), operation: 'delete', table, rowId: id }];
      set({ [listKey]: list.filter((x) => x.id !== id), syncQueue: queue }); persistQueue(queue); get().cache(); return;
    }
    const { error } = await requireSupabase().from(table).delete().eq('id', id);
    if (error) throw error;
    set({ [listKey]: list.filter((x) => x.id !== id) }); get().cache();
  },

  /* ── Accounts ───────────────────────────────────────────────────────── */
  addAccount: async (payload) => {
    const acc = await get().mutateEntity('accounts', 'accounts', { payload: { ...payload, balance: Number(payload.opening_balance || 0) } });
    get().recomputeAllBalances(); return acc;
  },
  updateAccount: async (id, payload) => {
    const acc = await get().mutateEntity('accounts', 'accounts', { id, payload });
    get().recomputeAllBalances(); return acc;
  },
  archiveAccount: (id) => get().updateAccount(id, { is_archived: true }),
  recomputeAllBalances: () => {
    set({ accounts: recomputeBalances(get().accounts, get().transactions) });
    get().cache();
  },

  /* ── Categories ─────────────────────────────────────────────────────── */
  addCategory: (payload) => get().mutateEntity('categories', 'categories', { payload }),
  updateCategory: (id, payload) => get().mutateEntity('categories', 'categories', { id, payload }),
  archiveCategory: (id) => get().updateCategory(id, { is_archived: true }),

  /* ── Assets / Liabilities / Goals ───────────────────────────────────── */
  addAsset: (payload) => get().mutateEntity('assets', 'assets', { payload }),
  updateAsset: (id, payload) => get().mutateEntity('assets', 'assets', { id, payload }),
  deleteAsset: (id) => get().deleteEntity('assets', 'assets', id),

  addLiability: (payload) => get().mutateEntity('liabilities', 'liabilities', { payload }),
  updateLiability: (id, payload) => get().mutateEntity('liabilities', 'liabilities', { id, payload }),
  deleteLiability: (id) => get().deleteEntity('liabilities', 'liabilities', id),

  addGoal: (payload) => get().mutateEntity('goals', 'goals', { payload }),
  updateGoal: (id, payload) => get().mutateEntity('goals', 'goals', { id, payload }),
  deleteGoal: (id) => get().deleteEntity('goals', 'goals', id),
  saveGoalContribution: async (id, amount) => {
    const goal = get().goals.find((g) => g.id === id);
    if (!goal) return;
    return get().updateGoal(id, { saved_amount: Number(goal.saved_amount) + Number(amount) });
  },


  /* ── Budgets (category / account / overall) ─────────────────────────── */
  saveBudget: async (payload) => {
    const client = requireSupabase();
    if (payload.scope === 'CATEGORY' && payload.category_id) {
      const { data, error } = await client.from('budgets').upsert(payload, { onConflict: 'user_id,category_id,month,year' })
        .select('*, categories(name, icon, color)').single();
      if (error) throw error;
      const rest = get().budgets.filter((x) => !(x.scope === 'CATEGORY' && x.category_id === data.category_id && x.month === data.month && x.year === data.year));
      set({ budgets: [data, ...rest] }); get().cache(); return data;
    }
    // ACCOUNT / TOTAL — replace any existing budget with the same key
    const match = { user_id: payload.user_id, month: payload.month, year: payload.year, scope: payload.scope };
    if (payload.scope === 'ACCOUNT') match.account_id = payload.account_id;
    const { error: delError } = await client.from('budgets').delete().match(match);
    if (delError) throw delError;
    const { data, error } = await client.from('budgets').insert(payload).select().single();
    if (error) throw error;
    const rest = get().budgets.filter((x) => !(
      x.month === data.month && x.year === data.year && x.scope === data.scope && (x.account_id || null) === (data.account_id || null)
    ));
    set({ budgets: [data, ...rest] }); get().cache(); return data;
  },
  deleteBudget: async (id) => {
    const { error } = await requireSupabase().from('budgets').delete().eq('id', id);
    if (error) throw error;
    set({ budgets: get().budgets.filter((x) => x.id !== id) }); get().cache();
  },

  /* ── Notifications ──────────────────────────────────────────────────── */
  markNotification: async (id) => {
    const { error } = await requireSupabase().from('notifications').update({ is_read: true }).eq('id', id);
    if (error) throw error;
    set({ notifications: get().notifications.map((x) => (x.id === id ? { ...x, is_read: true } : x)) }); get().cache();
  },
  markAllNotifications: async () => {
    const { error } = await requireSupabase().from('notifications').update({ is_read: true }).eq('is_read', false);
    if (error) throw error;
    set({ notifications: get().notifications.map((x) => ({ ...x, is_read: true })) }); get().cache();
  },

  /* ── Offline sync ───────────────────────────────────────────────────── */
  processQueue: async () => {
    const queue = get().syncQueue;
    if (!navigator.onLine || !queue.length || get().syncing) return;
    set({ syncing: true });
    const client = requireSupabase();
    const remaining = [];
    for (const action of queue) {
      let result;
      if (action.operation === 'rpc') {
        result = await client.rpc(action.fn, action.payload);
      } else if (action.operation === 'update') {
        const { data, error } = await client.from(action.table).update(action.payload).eq('id', action.rowId).select('id');
        result = { error: error || (data?.length ? null : { message: 'Row not found for queued update' }) };
      } else if (action.operation === 'delete') {
        result = await client.from(action.table).delete().eq('id', action.rowId);
      } else {
        result = await client.from(action.table).insert(action.payload);
      }
      if (result.error) {
        // 23505 = unique_violation (already synced). Also drop missing row updates to prevent blocking.
        const isDuplicateInsert = action.operation === 'insert' && result.error.code === '23505';
        const isMissingUpdate = action.operation === 'update' && result.error.message === 'Row not found for queued update';
        if (!isDuplicateInsert && !isMissingUpdate) {
          console.error('Offline sync error for action:', action, result.error);
          remaining.push(action);
        }
      }
    }
    set({ syncQueue: remaining, syncing: false }); persistQueue(remaining);
    if (!remaining.length) await get().fetchAll();
  },

  clear: () => set({
    transactions: [], categories: [], budgets: [], notifications: [],
    accounts: [], transfers: [], assets: [], liabilities: [], goals: [], syncQueue: [],
  }),
}));
