import { RefreshCw, Wifi } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';

// The update toast only matters for users running the installed PWA (standalone mode),
// where updates are silent and need an explicit reload. Regular browser visitors pick up
// the new version automatically on their next page load, so the toast is hidden for them.
const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

export default function PwaSupport() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  const toast = (() => {
    if (needRefresh && isStandalone) {
      return {
        icon: <RefreshCw size={16} className="shrink-0" />,
        text: 'A new version of Monetra is available. Please update the installed app.',
        actions: (
          <div className="flex shrink-0 gap-1.5">
            <button className="rounded-lg bg-white/10 px-2.5 py-1 text-xs font-bold text-white transition hover:bg-white/20" onClick={() => updateServiceWorker(true)}>Reload</button>
            <button className="rounded-lg px-2 py-1 text-xs font-semibold text-white/70 transition hover:text-white" onClick={() => setNeedRefresh(false)}>Dismiss</button>
          </div>
        ),
      };
    }
    if (offlineReady) {
      return {
        icon: <Wifi size={16} className="shrink-0" />,
        text: 'Monetra is ready to work offline.',
        actions: (
          <button className="rounded-lg px-2 py-1 text-xs font-semibold text-white/70 transition hover:text-white" onClick={() => setOfflineReady(false)}>Got it</button>
        ),
      };
    }
    return null;
  })();

  return toast ? (
    <div className="fixed bottom-24 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 lg:bottom-6 animate-fade-in">
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/95 px-4 py-3 text-sm text-white shadow-2xl backdrop-blur">
        {toast.icon}
        <p className="min-w-0 flex-1 font-medium">{toast.text}</p>
        {toast.actions}
      </div>
    </div>
  ) : null;
}
