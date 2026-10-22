import { Gamepad2 } from 'lucide-react';

const GRADIENTS = [
  'linear-gradient(135deg, #3B1D6E 0%, #7C3AED 55%, #C026D3 100%)',
  'linear-gradient(135deg, #1F2937 0%, #374151 55%, #92400E 100%)',
  'linear-gradient(135deg, #7C2D12 0%, #D97706 55%, #FBBF24 100%)',
  'linear-gradient(135deg, #0F3D3E 0%, #0F766E 55%, #34D399 100%)',
  'linear-gradient(135deg, #1E3A8A 0%, #2563EB 55%, #38BDF8 100%)',
  'linear-gradient(135deg, #7F1D1D 0%, #DC2626 55%, #F97316 100%)',
];

export function gradientFor(name = '') {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 997;
  return GRADIENTS[h % GRADIENTS.length];
}

// Placeholder artwork until sellers upload real screenshots
export default function GameArt({ game, className = '', image }) {
  if (image) {
    return <img src={image} alt={game} className={`object-cover ${className}`} />;
  }
  return (
    <div
      className={`relative overflow-hidden flex items-center justify-center ${className}`}
      style={{ background: gradientFor(game) }}
    >
      <Gamepad2 size={64} className="absolute -right-3 -bottom-3 text-white/15" strokeWidth={1.25} />
      <span className="font-display font-bold text-white/90 text-lg px-3 text-center drop-shadow">
        {game}
      </span>
    </div>
  );
}