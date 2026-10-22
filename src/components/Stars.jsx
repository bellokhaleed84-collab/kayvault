import { Star } from 'lucide-react';

export function Stars({ value = 0, size = 14 }) {
  const full = Math.round(value);
  return (
    <span className="inline-flex gap-0.5" role="img" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={size} className={n <= full ? 'text-[#D4A94B]' : 'text-slate-700'}
          fill={n <= full ? 'currentColor' : 'none'} />
      ))}
    </span>
  );
}

export function StarInput({ value, onChange }) {
  return (
    <span className="inline-flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onChange(n)} aria-label={`${n} star${n === 1 ? '' : 's'}`}
          className="p-0.5">
          <Star size={26} className={n <= value ? 'text-[#D4A94B]' : 'text-slate-600 hover:text-slate-400'}
            fill={n <= value ? 'currentColor' : 'none'} />
        </button>
      ))}
    </span>
  );
}