import iconSrc from '../assets/kayvault-icon.png';

// KV-LOGO v2: the neon K-V icon plus the name. Used by every header, the footer and the login pages.
// size = icon height in pixels. text={false} shows only the icon.
export default function Logo({ size = 34, text = true, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <img src={iconSrc} alt={text ? '' : 'KayVault'} style={{ height: size, width: 'auto' }} className="shrink-0 select-none" draggable="false" />
      {text && (
        <span className="font-display font-bold text-slate-100 text-lg tracking-tight">
          Kay<span className="bg-gradient-to-r from-[#B026FF] to-[#22D3EE] bg-clip-text text-transparent">Vault</span>
        </span>
      )}
    </span>
  );
}