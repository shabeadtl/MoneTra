import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { CircleDollarSign, Eye, EyeOff, Loader2, WifiOff } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { messageFrom } from '../lib/utils';

const features = [
  { emoji: '📊', text: 'Visual charts & spending breakdown' },
  { emoji: '💰', text: 'Track income, expenses & budgets' },
  { emoji: '📴', text: 'Works offline with automatic sync' },
];

export default function AuthPage() {
  const { session, signIn, signUp, resetPassword, configured } = useAuthStore();
  const [signup, setSignup] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ fullName: '', email: '', password: '' });
  const [status, setStatus] = useState({ busy: false, error: '', success: '' });

  if (session) return <Navigate to="/" replace />;

  async function submit(e) {
    e.preventDefault();
    setStatus({ busy: true, error: '', success: '' });
    try {
      if (resetMode) {
        await resetPassword(form.email);
        setStatus({
          busy: false, error: '',
          success: 'Check your email for the password reset link.',
        });
      } else if (signup) {
        const data = await signUp(form);
        setStatus({
          busy: false, error: '',
          success: data.session ? 'Account created. Welcome!' : 'Check your email to confirm your account.',
        });
      } else {
        await signIn(form.email, form.password);
      }
    } catch (error) {
      setStatus({ busy: false, error: messageFrom(error), success: '' });
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* Left panel */}
      <section className="relative hidden overflow-hidden bg-gradient-to-br from-brand-900 via-brand-800 to-brand-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        {/* Decorative blobs */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-brand-700/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-brand-600/20 blur-3xl" />

        <div className="relative flex items-center gap-3 text-2xl font-black">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
            <CircleDollarSign size={22} />
          </span>
          Monetra
        </div>

        <div className="relative max-w-lg">
          <p className="mb-4 text-sm font-bold uppercase tracking-[.25em] text-brand-200">
            Money, made clear
          </p>
          <h1 className="text-5xl font-black leading-tight">
            Own your spending.<br />Build your future.
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-brand-100">
            Track every rupee, set meaningful budgets, and keep working even when your internet doesn&apos;t.
          </p>

          <ul className="mt-8 space-y-3">
            {features.map((f) => (
              <li key={f.text} className="flex items-center gap-3 text-sm text-brand-100">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10 text-base">
                  {f.emoji}
                </span>
                {f.text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-sm text-brand-200">
          Secure by Supabase · Offline-ready PWA
        </p>
      </section>

      {/* Right panel */}
      <section className="grid place-items-center bg-white p-5 dark:bg-slate-900">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="mb-8 flex items-center gap-3 text-2xl font-black lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-700 text-white">
              <CircleDollarSign size={20} />
            </span>
            Monetra
          </div>

          <h2 className="text-3xl font-black">
            {resetMode ? 'Reset password' : signup ? 'Create your account' : 'Welcome back'}
          </h2>
          <p className="mt-2 text-slate-500">
            {resetMode ? 'Enter your email to receive a reset link.' : signup ? 'Start taking control of your money.' : 'Sign in to your finance workspace.'}
          </p>

          {/* Supabase not configured warning */}
          {!configured && (
            <div className="mt-5 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800/30 dark:bg-amber-950/40 dark:text-amber-200">
              <WifiOff className="mt-0.5 shrink-0" size={18} />
              <span>
                Supabase is not configured. Copy <b>.env.example</b> to <b>.env.local</b> and add your project credentials, then restart the dev server.
              </span>
            </div>
          )}

          <form onSubmit={submit} className="mt-7 space-y-4">
            {status.error && (
              <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-950/40 dark:text-red-300">
                {status.error}
              </div>
            )}
            {status.success && (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-950/40 dark:text-emerald-300">
                {status.success}
              </div>
            )}

            {!resetMode && signup && (
              <div>
                <label className="label">Full name</label>
                <input
                  className="field"
                  required
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  autoComplete="name"
                  placeholder="John Doe"
                />
              </div>
            )}

            <div>
              <label className="label">Email address</label>
              <input
                className="field"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                autoComplete="email"
                placeholder="you@example.com"
              />
            </div>

            {!resetMode && (
              <div>
                <div className="flex items-center justify-between">
                  <label className="label">Password</label>
                  {!signup && (
                    <button
                      type="button"
                      className="text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
                      onClick={() => { setResetMode(true); setStatus({ busy: false, error: '', success: '' }); }}
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    className="field pr-11"
                    type={show ? 'text' : 'password'}
                    minLength={8}
                    required
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    autoComplete={signup ? 'new-password' : 'current-password'}
                    placeholder="Min. 8 characters"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-2.5 text-slate-400 transition hover:text-slate-600"
                    onClick={() => setShow(!show)}
                  >
                    {show ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
            )}

            <button className="btn-primary w-full" disabled={status.busy || !configured}>
              {status.busy
                ? <><Loader2 size={16} className="animate-spin" /> Please wait…</>
                : resetMode ? 'Send reset link' : signup ? 'Create account' : 'Sign in'
              }
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            {resetMode ? (
              <button
                className="font-semibold text-brand-700 hover:underline dark:text-brand-400"
                onClick={() => { setResetMode(false); setStatus({ busy: false, error: '', success: '' }); }}
              >
                Back to sign in
              </button>
            ) : (
              <>
                {signup ? 'Already have an account?' : 'New to Monetra?'}{' '}
                <button
                  className="font-semibold text-brand-700 hover:underline dark:text-brand-400"
                  onClick={() => { setSignup(!signup); setStatus({ busy: false, error: '', success: '' }); }}
                >
                  {signup ? 'Sign in' : 'Create account'}
                </button>
              </>
            )}
          </p>
        </div>
      </section>
    </main>
  );
}
