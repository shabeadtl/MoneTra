export default function Spinner({ full = false, size = 'md', label }) {
  const ring = {
    sm: 'h-5 w-5 border-2',
    md: 'h-8 w-8 border-[3px]',
    lg: 'h-12 w-12 border-4',
  }[size] ?? 'h-8 w-8 border-[3px]';

  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${full ? 'min-h-screen' : 'py-14'}`}>
      <div className="relative">
        {/* Track ring */}
        <span className={`block ${ring} rounded-full border-brand-100 dark:border-brand-900`} />
        {/* Spinning ring */}
        <span
          className={`absolute inset-0 block ${ring} animate-spin-slow rounded-full border-transparent border-t-brand-600`}
          style={{ borderTopColor: '#0f766e' }}
        />
      </div>
      {label && <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>}
    </div>
  );
}
