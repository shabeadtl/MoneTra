import { Link } from 'react-router-dom';
import { Home, MoveLeft } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-br from-slate-50 to-brand-50 p-6 dark:from-slate-950 dark:to-brand-950">
      <div className="animate-fade-in text-center">
        {/* Big decorative number */}
        <div className="relative inline-block select-none">
          <p className="text-[10rem] font-black leading-none tracking-tighter text-brand-100 dark:text-brand-950">
            404
          </p>
          <p className="absolute inset-0 flex items-center justify-center text-[5rem] font-black leading-none tracking-tighter text-brand-700 dark:text-brand-300">
            404
          </p>
        </div>

        <h1 className="mt-6 text-2xl font-black text-slate-800 dark:text-slate-100">
          That page wandered off.
        </h1>
        <p className="mt-3 max-w-xs text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          Don&apos;t worry — your money is still exactly where you left it. Let&apos;s get you back on track.
        </p>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link to="/" className="btn-primary gap-2">
            <Home size={17} />
            Back to Dashboard
          </Link>
          <button onClick={() => window.history.back()} className="btn-secondary gap-2">
            <MoveLeft size={17} />
            Go Back
          </button>
        </div>
      </div>
    </main>
  );
}
