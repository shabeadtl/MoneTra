import { create } from 'zustand';
import { isSupabaseConfigured, requireSupabase, supabase } from '../lib/supabase';

export const useAuthStore = create((set, get) => ({
  session: null,
  user: null,
  profile: null,
  loading: true,
  configured: isSupabaseConfigured,
  initialize: async () => {
    if (!supabase) return set({ loading: false });
    const { data } = await supabase.auth.getSession();
    set({ session: data.session, user: data.session?.user || null });
    if (data.session) await get().loadProfile();
    set({ loading: false });
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      set({ session, user: session?.user || null, profile: session ? get().profile : null });
      if (session) await get().loadProfile();
    });
    return () => listener.subscription.unsubscribe();
  },
  loadProfile: async () => {
    const user = get().user;
    if (!user || !supabase) return;
    const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (!error) {
      document.documentElement.classList.toggle('dark', data.theme_preference === 'dark');
      set({ profile: data });
    }
  },
  signIn: async (email, password) => {
    const { error } = await requireSupabase().auth.signInWithPassword({ email, password });
    if (error) throw error;
  },
  signUp: async ({ email, password, fullName }) => {
    const { data, error } = await requireSupabase().auth.signUp({ email, password, options: { data: { full_name: fullName } } });
    if (error) throw error;
    return data;
  },
  signOut: async () => {
    await requireSupabase().auth.signOut();
    set({ session: null, user: null, profile: null });
  },
  updateProfile: async (updates) => {
    const user = get().user;
    const { data, error } = await requireSupabase().from('profiles').update(updates).eq('id', user.id).select().single();
    if (error) throw error;
    document.documentElement.classList.toggle('dark', data.theme_preference === 'dark');
    set({ profile: data });
  },
  uploadAvatar: async (file) => {
    const user = get().user;
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${user.id}/avatar-${Date.now()}.${extension}`;
    const client = requireSupabase();
    const { error } = await client.storage.from('avatars').upload(path, file, { upsert: true });
    if (error) throw error;
    const { data } = client.storage.from('avatars').getPublicUrl(path);
    await get().updateProfile({ avatar_url: data.publicUrl });
  },
  updatePassword: async (password) => {
    const { error } = await requireSupabase().auth.updateUser({ password });
    if (error) throw error;
  }
}));
