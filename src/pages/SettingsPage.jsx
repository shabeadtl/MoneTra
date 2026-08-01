import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, Check, Download, Lock, Moon, Save, ShieldCheck, Smartphone, Sun, X } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { messageFrom } from '../lib/utils';

function StatusBanner({ msg, type = 'info', onClose }) {
  if (!msg) return null;
  const styles = {
    info:    'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-200 border-brand-100 dark:border-brand-900/40',
    success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-100 dark:border-emerald-900/40',
    error:   'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border-red-100 dark:border-red-900/40',
  };
  return (
    <div className={`mb-5 flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-medium ${styles[type]}`}>
      <span className="flex items-center gap-2">
        {type === 'success' ? <Check size={15} /> : null}
        {msg}
      </span>
      <button onClick={onClose} className="ml-3 rounded p-0.5 hover:opacity-70"><X size={15} /></button>
    </div>
  );
}

export default function SettingsPage() {
  const { profile, user, updateProfile, uploadAvatar, updatePassword } = useAuthStore();
  const [form, setForm] = useState({
    full_name: '', currency: 'INR', theme_preference: 'light', email_notifications: true,
  });
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState({ msg: '', type: 'info' });
  const [saving, setSaving] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);

  const notify = (msg, type = 'info') => setStatus({ msg, type });

  useEffect(() => {
    if (profile) setForm({
      full_name: profile.full_name,
      currency: profile.currency,
      theme_preference: profile.theme_preference,
      email_notifications: profile.email_notifications,
    });
  }, [profile]);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try { await updateProfile(form); notify('Preferences saved.', 'success'); }
    catch (err) { notify(messageFrom(err), 'error'); }
    finally { setSaving(false); }
  }

  async function avatar(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return notify('Avatar must be smaller than 2 MB.', 'error');
    notify('Uploading…');
    try { await uploadAvatar(file); notify('Avatar updated.', 'success'); }
    catch (err) { notify(messageFrom(err), 'error'); }
  }

  async function changePassword(e) {
    e.preventDefault();
    setPwSaving(true);
    try { await updatePassword(password); setPassword(''); notify('Password changed successfully.', 'success'); }
    catch (err) { notify(messageFrom(err), 'error'); }
    finally { setPwSaving(false); }
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-3xl font-black">Settings</h1>
        <p className="mt-1 text-slate-500">Personalize Monetra and manage account security.</p>
      </div>

      <StatusBanner msg={status.msg} type={status.type} onClose={() => setStatus({ msg: '', type: 'info' })} />

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Profile card */}
        <section className="card xl:col-span-2">
          <h2 className="text-lg font-bold">Profile & preferences</h2>

          {/* Avatar */}
          <div className="mt-5 flex items-center gap-4">
            <div className="relative">
              {profile?.avatar_url
                ? <img src={profile.avatar_url} className="h-20 w-20 rounded-2xl object-cover ring-2 ring-brand-100 dark:ring-brand-900" alt="Profile" />
                : <span className="grid h-20 w-20 place-items-center rounded-2xl bg-gradient-to-br from-brand-100 to-brand-200 text-2xl font-black text-brand-700 dark:from-brand-900/50 dark:to-brand-800/50 dark:text-brand-300">
                    {form.full_name?.[0] || 'M'}
                  </span>
              }
              <label
                className="absolute -bottom-2 -right-2 cursor-pointer rounded-full bg-brand-700 p-2 text-white shadow-md transition hover:bg-brand-600"
                title="Change avatar"
              >
                <Camera size={15} />
                <input className="hidden" type="file" accept="image/png,image/jpeg,image/webp" onChange={avatar} />
              </label>
            </div>
            <div>
              <p className="font-bold">{form.full_name}</p>
              <p className="text-sm text-slate-500">{user?.email}</p>
              <p className="mt-1 text-xs text-slate-400">JPG, PNG or WebP · max 2 MB</p>
            </div>
          </div>

          {/* Profile form */}
          <form className="mt-7 space-y-5" onSubmit={save}>
            <div>
              <label className="label">Full name</label>
              <input
                className="field"
                required
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              />
            </div>

            <div>
              <label className="label">Currency</label>
              <select
                className="field"
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
              >
                {[
                  ['INR', '₹ Indian Rupee'],
                  ['USD', '$ US Dollar'],
                  ['EUR', '€ Euro'],
                  ['GBP', '£ British Pound'],
                ].map(([v, label]) => (
                  <option key={v} value={v}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Appearance</label>
              <div className="grid grid-cols-2 gap-3">
                {[['light', Sun, 'Light'], ['dark', Moon, 'Dark']].map(([theme, Icon, label]) => (
                  <button
                    type="button"
                    key={theme}
                    onClick={() => setForm({ ...form, theme_preference: theme })}
                    className={`btn-secondary capitalize justify-start gap-3 ${
                      form.theme_preference === theme
                        ? 'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-500/20 dark:bg-brand-900/30 dark:text-brand-300'
                        : ''
                    }`}
                  >
                    <Icon size={18} />
                    {label} mode
                    {form.theme_preference === theme && (
                      <Check size={15} className="ml-auto" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex cursor-pointer items-center justify-between rounded-xl border bg-slate-50 p-4 transition hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800">
              <span>
                <b className="block text-sm font-semibold">Email notifications</b>
                <span className="text-xs text-slate-500">Receive account and budget updates</span>
              </span>
              <div className="relative">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={form.email_notifications}
                  onChange={(e) => setForm({ ...form, email_notifications: e.target.checked })}
                />
                <div className={`h-6 w-11 rounded-full transition-colors ${form.email_notifications ? 'bg-brand-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
                  <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${form.email_notifications ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
              </div>
            </label>

            <button className="btn-primary" disabled={saving}>
              <Save size={17} />
              {saving ? 'Saving…' : 'Save preferences'}
            </button>
          </form>
        </section>

        {/* Security card */}
        <section className="card h-fit">
          <div className="flex items-center gap-2">
            <Lock size={18} className="text-slate-500" />
            <h2 className="text-lg font-bold">Security</h2>
          </div>
          <p className="mt-1 text-sm text-slate-500">Use at least 8 characters. Include letters and numbers for a stronger password.</p>
          <form className="mt-5 space-y-4" onSubmit={changePassword}>
            <div>
              <label className="label">New password</label>
              <input
                className="field"
                type="password"
                minLength={8}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="Min. 8 characters"
              />
            </div>
            <button className="btn-secondary w-full" disabled={pwSaving}>
              {pwSaving ? 'Updating…' : 'Change password'}
            </button>
          </form>

          {/* Account info */}
          <div className="mt-6 rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Account</p>
            <p className="mt-2 truncate text-sm font-medium">{user?.email}</p>
            <p className="mt-1 text-xs text-slate-400">
              Member since {user?.created_at ? new Date(user.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : '—'}
            </p>
          </div>

          {/* Admin Diagnostics entry point for mobile */}
          {(user?.app_metadata?.is_staff || user?.app_metadata?.role === 'admin') && (
            <div className="mt-6 rounded-xl border border-brand-100 bg-brand-50/30 p-4 dark:border-brand-900/40 dark:bg-brand-950/20">
              <div className="flex items-center gap-2 text-brand-800 dark:text-brand-300">
                <ShieldCheck size={18} />
                <h3 className="text-sm font-bold">Admin Diagnostics</h3>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Access platforms statistics and privacy-safe aggregate system health metrics.
              </p>
              <Link to="/admin" className="btn-primary mt-4 w-full justify-center text-xs">
                Open diagnostics panel
              </Link>
            </div>
          )}
        </section>
      </div>

      {/* Install / PWA guide */}
      <InstallCard standalone={window.matchMedia('(display-mode: standalone)').matches} />
    </>
  );
}

function InstallCard({ standalone }) {
  const steps = [
    {
      title: 'iOS (iPhone / iPad)',
      detail: 'Tap the Share button in Safari, then choose “Add to Home Screen”.',
      icon: <Smartphone size={18} />,
    },
    {
      title: 'Android / Chrome',
      detail: 'Open the menu (⋮) and tap “Install app”, or use the install icon in the address bar.',
      icon: <Download size={18} />,
    },
    {
      title: 'Desktop (Chrome / Edge)',
      detail: 'Click the install icon in the address bar, or the “Install” button in the top bar.',
      icon: <Download size={18} />,
    },
  ];

  return (
    <section className="card mt-6">
      <div className="flex items-center gap-2">
        <Download size={18} className="text-brand-700 dark:text-brand-300" />
        <h2 className="text-lg font-bold">Install Monetra</h2>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Install Monetra on your device for a full-screen, offline-ready app experience.
      </p>

      {standalone ? (
        <div className="mt-5 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
          <Check size={16} />
          You&apos;re using the installed app. 🎉
        </div>
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {steps.map((s, i) => (
            <div key={s.title} className="rounded-xl border bg-slate-50 p-4 dark:bg-slate-800/50">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                  {s.icon}
                </span>
                <p className="text-sm font-bold">{i + 1}. {s.title}</p>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{s.detail}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
