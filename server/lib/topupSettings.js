// KV-EYAD v1: top-up settings (provider, Naira rate, profit %) kept in the database so admin can change them anytime.
import Setting from '../models/Setting.js';

const KEY = 'topup_settings';
export const PROVIDERS = ['eyad', 'gamesdrop'];
const DEFAULTS = { provider: 'eyad', usd_ngn: 0, profit_percent: 20, eyad_games: [] };

let box = { at: 0, val: null };

function normalise(v) {
  const o = v && typeof v === 'object' ? v : {};
  const rate = Number(o.usd_ngn);
  const profit = Number(o.profit_percent);
  return {
    provider: PROVIDERS.includes(o.provider) ? o.provider : DEFAULTS.provider,
    usd_ngn: Number.isFinite(rate) && rate >= 100 && rate <= 20000 ? rate : 0,
    profit_percent: Number.isFinite(profit) && profit >= 0 && profit <= 300 ? profit : DEFAULTS.profit_percent,
    eyad_games: Array.isArray(o.eyad_games)
      ? o.eyad_games.filter((g) => typeof g === 'string' && /^[a-z0-9_]{1,60}$/.test(g)).slice(0, 300)
      : [],
  };
}

export async function getSettings(force = false) {
  if (!force && box.val && Date.now() - box.at < 15000) return box.val;
  const row = await Setting.findOne({ key: KEY }).lean();
  const val = normalise(row && row.value);
  box = { at: Date.now(), val };
  return val;
}

// Returns { settings } or { error }
export async function saveSettings(p) {
  const cur = await getSettings(true);
  const next = { ...cur };
  if (p.provider !== undefined) {
    if (!PROVIDERS.includes(p.provider)) return { error: 'Choose Eyad or GamesDrop' };
    next.provider = p.provider;
  }
  if (p.usd_ngn !== undefined) {
    const n = Number(p.usd_ngn);
    if (!(n === 0 || (Number.isFinite(n) && n >= 100 && n <= 20000))) return { error: 'The rate must be between 100 and 20,000 Naira per dollar' };
    next.usd_ngn = n;
  }
  if (p.profit_percent !== undefined) {
    const n = Number(p.profit_percent);
    if (!(Number.isFinite(n) && n >= 0 && n <= 300)) return { error: 'Profit must be between 0 and 300 percent' };
    next.profit_percent = n;
  }
  if (p.eyad_games !== undefined) {
    if (!Array.isArray(p.eyad_games) || p.eyad_games.length > 300 || p.eyad_games.some((g) => typeof g !== 'string' || !/^[a-z0-9_]{1,60}$/.test(g))) {
      return { error: 'The game list is not valid' };
    }
    next.eyad_games = p.eyad_games;
  }
  await Setting.updateOne({ key: KEY }, { $set: { value: next } }, { upsert: true });
  box = { at: Date.now(), val: next };
  return { settings: next };
}

// Eyad USD price x Naira rate x (1 + profit), rounded up to the next 10 Naira
export function nairaPrice(usd, rate, profit) {
  return Math.ceil((Number(usd) * rate * (1 + profit / 100)) / 10 - 1e-9) * 10;
}