import { create } from 'zustand';
import { requireSupabase } from '../lib/supabase';

const QUEUE_KEY = 'monetra_offline_queue';
const CACHE_KEY = 'monetra_data_cache';
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const persistQueue = (queue) => localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));

export const useDataStore = create((set, get) => ({
  transactions: read(CACHE_KEY, {}).transactions || [],
  categories: read(CACHE_KEY, {}).categories || [],
  budgets: read(CACHE_KEY, {}).budgets || [],
  notifications: read(CACHE_KEY, {}).notifications || [],
  syncQueue: read(QUEUE_KEY, []),
  loading: false,
  syncing: false,
  error: null,
  cache: () => {
    const s = get();
    localStorage.setItem(CACHE_KEY, JSON.stringify({ transactions: s.transactions, categories: s.categories, budgets: s.budgets, notifications: s.notifications }));
  },
  fetchAll: async () => {
    if (!navigator.onLine) return;
    set({ loading: true, error: null });
    const client = requireSupabase();
    const [tx, cats, budgets, notes] = await Promise.all([
      client.from('transactions').select('*, categories(name, icon, color)').order('date', { ascending: false }),
      client.from('categories').select('*').order('name'),
      client.from('budgets').select('*, categories(name, icon, color)').order('year', { ascending: false }),
      client.from('notifications').select('*').order('created_at', { ascending: false })
    ]);
    const error = tx.error || cats.error || budgets.error || notes.error;
    if (error) return set({ loading: false, error: error.message });
    set({ transactions: tx.data, categories: cats.data, budgets: budgets.data, notifications: notes.data, loading: false });
    get().cache();
  },
  addTransaction: async (payload) => {
    if (!navigator.onLine) {
      const category = get().categories.find((c) => c.id === payload.category_id);
      const pending = { ...payload, id: crypto.randomUUID(), local_only: true, categories: category };
      const action = { id: crypto.randomUUID(), operation: 'insert', table: 'transactions', payload: { ...payload, id: pending.id } };
      const queue = [...get().syncQueue, action];
      set({ transactions: [pending, ...get().transactions], syncQueue: queue });
      persistQueue(queue); get().cache(); return pending;
    }
    const { data, error } = await requireSupabase().from('transactions').insert(payload).select('*, categories(name, icon, color)').single();
    if (error) throw error;
    set({ transactions: [data, ...get().transactions] }); get().cache(); return data;
  },
  updateTransaction: async (id, payload) => {
    if (!navigator.onLine) {
      const tx = get().transactions.find((x) => x.id === id);
      if (tx?.local_only) {
        // Merge the edit into the pending insert so it lands atomically on sync
        const queue = get().syncQueue.map((a) =>
          a.operation === 'insert' && a.payload.id === id
            ? { ...a, payload: { ...a.payload, ...payload } }
            : a
        );
        set({ transactions: get().transactions.map((x) => x.id === id ? { ...x, ...payload } : x), syncQueue: queue });
        persistQueue(queue); get().cache(); return;
      }
      const action = { id: crypto.randomUUID(), operation: 'update', table: 'transactions', rowId: id, payload };
      const queue = [...get().syncQueue, action];
      set({ transactions: get().transactions.map((x) => x.id === id ? { ...x, ...payload } : x), syncQueue: queue });
      persistQueue(queue); get().cache(); return;
    }
    const { data, error } = await requireSupabase().from('transactions').update(payload).eq('id', id).select('*, categories(name, icon, color)').single();
    if (error) throw error;
    set({ transactions: get().transactions.map((x) => x.id === id ? data : x) }); get().cache();
  },
  deleteTransaction: async (id) => {
    const tx = get().transactions.find((x) => x.id === id);
    if (tx?.local_only) {
      const queue = get().syncQueue.filter((x) => x.payload.id !== id);
      set({ transactions: get().transactions.filter((x) => x.id !== id), syncQueue: queue }); persistQueue(queue); get().cache(); return;
    }
    if (!navigator.onLine) {
      // Drop any pending edits for this row — the user's final intent is deletion
      const action = { id: crypto.randomUUID(), operation: 'delete', table: 'transactions', rowId: id };
      const queue = [...get().syncQueue.filter((a) => !(a.operation === 'update' && a.rowId === id)), action];
      set({ transactions: get().transactions.filter((x) => x.id !== id), syncQueue: queue }); persistQueue(queue); get().cache(); return;
    }
    const { error } = await requireSupabase().from('transactions').delete().eq('id', id);
    if (error) throw error;
    set({ transactions: get().transactions.filter((x) => x.id !== id) }); get().cache();
  },
  addCategory: async (payload) => {
    const { data, error } = await requireSupabase().from('categories').insert(payload).select().single();
    if (error) throw error;
    set({ categories: [...get().categories, data].sort((a, b) => a.name.localeCompare(b.name)) }); get().cache(); return data;
  },
  saveBudget: async (payload) => {
    const { data, error } = await requireSupabase().from('budgets').upsert(payload, { onConflict: 'user_id,category_id,month,year' }).select('*, categories(name, icon, color)').single();
    if (error) throw error;
    const rest = get().budgets.filter((x) => !(x.category_id === data.category_id && x.month === data.month && x.year === data.year));
    set({ budgets: [data, ...rest] }); get().cache();
  },
  deleteBudget: async (id) => {
    const { error } = await requireSupabase().from('budgets').delete().eq('id', id);
    if (error) throw error;
    set({ budgets: get().budgets.filter((x) => x.id !== id) }); get().cache();
  },
  markNotification: async (id) => {
    const { error } = await requireSupabase().from('notifications').update({ is_read: true }).eq('id', id);
    if (error) throw error;
    set({ notifications: get().notifications.map((x) => x.id === id ? { ...x, is_read: true } : x) }); get().cache();
  },
  markAllNotifications: async () => {
    const { error } = await requireSupabase().from('notifications').update({ is_read: true }).eq('is_read', false);
    if (error) throw error;
    set({ notifications: get().notifications.map((x) => ({ ...x, is_read: true })) }); get().cache();
  },
  processQueue: async () => {
    const queue = get().syncQueue;
    if (!navigator.onLine || !queue.length || get().syncing) return;
    set({ syncing: true });
    const client = requireSupabase();
    const remaining = [];
    for (const action of queue) {
      let result;
      if (action.operation === 'update') {
        const { data, error } = await client.from(action.table).update(action.payload).eq('id', action.rowId).select('id');
        // Only count as synced if a row actually matched — otherwise keep it queued
        result = { error: error || (data?.length ? null : { message: 'Row not found for queued update' }) };
      } else if (action.operation === 'delete') {
        result = await client.from(action.table).delete().eq('id', action.rowId);
      } else {
        result = await client.from(action.table).insert(action.payload);
      }
      if (result.error) remaining.push(action);
    }
    set({ syncQueue: remaining, syncing: false }); persistQueue(remaining);
    if (!remaining.length) await get().fetchAll();
  },
  clear: () => set({ transactions: [], categories: [], budgets: [], notifications: [], syncQueue: [] })
}));
