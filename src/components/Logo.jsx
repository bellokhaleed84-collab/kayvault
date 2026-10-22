export default function Logo({ size = 28, text = true, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="kvLogoGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#F2D48A" />
            <stop offset="1" stopColor="#C9A15A" />
          </linearGradient>
        </defs>
        <path d="M5 3h6v10l9-10h8L16 16l13 13h-8.5L11 19v10H5z" fill="url(#kvLogoGrad)" />
      </svg>
      {text && (
        <span className="font-display font-bold text-slate-100 text-lg tracking-tight">KayVault</span>
      )}
    </span>
  );
}