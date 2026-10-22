import { Heart } from 'lucide-react';
import GameArt from './GameArt';

const BADGES = {
  live: { text: 'Live', cls: 'bg-[#34D399]/15 text-[#34D399]' },
  pending: { text: 'Pending', cls: 'bg-[#D4A94B]/15 text-[#D4A94B]' },
  sold: { text: 'Sold', cls: 'bg-[#5B8DEF]/15 text-[#5B8DEF]' },
};

export default function AccountCard({ game, tier, price, status = 'live', image, onClick, action }) {
  const badge = BADGES[status] || BADGES.live;
  return (
    <div
      onClick={onClick}
      className={`group rounded-xl bg-[#131B2E] border border-slate-800 overflow-hidden hover:border-[#D4A94B]/50 transition-colors ${
        onClick ? 'cursor-pointer' : ''
      }`}
    >
      <div className="relative">
        <GameArt game={game} image={image} className="h-36 w-full" />
        <button
          type="button"
          aria-label="Save"
          className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-black/40 flex items-center justify-center text-white/80 hover:text-[#F87171] transition-colors"
        >
          <Heart size={14} />
        </button>
      </div>
      <div className="p-4">
        <h3 className="font-display text-slate-100 font-semibold leading-tight">{game}</h3>
        <p className="text-xs text-slate-500 mt-1 mb-3">{tier}</p>
        <div className="flex items-center justify-between">
          <p className="font-mono text-[#D4A94B] font-semibold">&#8358;{Number(price).toLocaleString()}</p>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${badge.cls}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current" /> {badge.text}
          </span>
        </div>
        {action && <div className="mt-4">{action}</div>}
      </div>
    </div>
  );
}