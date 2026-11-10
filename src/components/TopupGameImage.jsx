// KV-EYAD v2: a picture from public/topup/<game id>.jpg|png|webp when you have added one, otherwise a coloured tile with the initials.
// Regional versions of a game (freefire_id, codm_sg, mlbb_ph ...) share the main game's picture.
import { useState } from 'react';

const EXT = ['jpg', 'png', 'webp'];

const SHARE = [
  [/^freefire_/, 'freefire_global'],
  [/^codm_/, 'codm_id'],
  [/^blood_?strike/, 'bloodstrike'],
  [/^mlbb_(?!adventure)/, 'mlbb'],
  [/^pubgm_/, 'pubgm'],
  [/^genshin_/, 'genshin'],
  [/^hsr_/, 'hsr'],
  [/^zzz_/, 'zzz'],
  [/^(honkai_impact_3rd_|honkai3)/, 'honkai3'],
  [/^(delta_?force|garena_delta_force)/, 'deltaforce'],
  [/^wild_rift_/, 'wild_rift_id'],
  [/^league_of_legends_pc_/, 'league_of_legends_pc_ph'],
  [/^valorant_/, 'valorant_id'],
  [/^pokemon_unite_/, 'pokemon_unite_id'],
  [/^mico_live_/, 'mico_live'],
  [/^mango_live_/, 'mango_live'],
  [/^bleach_soul/, 'bleach_soul'],
  [/^ragnarok_origin_/, 'ragnarok_origin'],
  [/^magic_chess_/, 'magic_chess'],
  [/^rainbow_six_mobile_/, 'rsm'],
  [/^garena_undawn_/, 'garena_undawn_id'],
  [/^guns_of_glory_/, 'guns_of_glory_uid'],
  [/^telegram_/, 'telegram_stars'],
];

const baseOf = (id) => {
  const s = String(id);
  for (const [re, base] of SHARE) if (re.test(s)) return base;
  return s;
};

const hueOf = (s) => {
  let h = 0;
  for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
};

export default function TopupGameImage({ game, className = '' }) {
  const [i, setI] = useState(0);
  const id = String(game.id);
  const base = baseOf(id);
  const names = id === base ? [id] : [id, base];
  const urls = names.flatMap((n) => EXT.map((e) => `/topup/${n}.${e}`));

  if (i < urls.length) {
    return (
      <img
        src={urls[i]}
        alt=""
        loading="lazy"
        onError={() => setI(i + 1)}
        className={`${className} object-cover`}
      />
    );
  }
  const h = hueOf(base);
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