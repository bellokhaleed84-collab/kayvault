// KV-EYAD v1: a picture from public/topup/<game id>.jpg|png|webp when you have added one, otherwise a coloured tile with the initials
import { useState } from 'react';

const EXT = ['jpg', 'png', 'webp'];
const hueOf = (s) => {
  let h = 0;
  for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
};

export default function TopupGameImage({ game, className = '' }) {
  const [i, setI] = useState(0);
  if (i < EXT.length) {
    return (
      <img
        src={`/topup/${game.id}.${EXT[i]}`}
        alt=""
        loading="lazy"
        onError={() => setI(i + 1)}
        className={`${className} object-cover`}
      />
    );
  }
  const h = hueOf(game.id);
  const initials =
    String(game.name || '')
      .replace(/[^A-Za-z0-9 ]/g, '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase() || '?';
  return (
    <div
      className={`${className} flex items-center justify-center font-display font-bold text-2xl text-white/90`}
      style={{ background: `linear-gradient(135deg, hsl(${h} 55% 28%), hsl(${(h + 50) % 360} 60% 14%))` }}
    >
      {initials}
    </div>
  );
}