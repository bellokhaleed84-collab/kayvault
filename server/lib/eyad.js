// KV-EYAD v1: thin client for the Eyad Store partner API (server to server only).
// The key only ever comes from server/.env (EYAD_API_KEY) and is never logged or sent to the browser.
const BASE = 'https://reseller.eyadstore.gg';

const stamps = [];
export const configured = () => Boolean(process.env.EYAD_API_KEY);

// Calls made in the last 60 seconds. Eyad allows 60 per minute per key, shared by every call type.
export function used() {
  const cut = Date.now() - 60 * 1000;
  while (stamps.length && stamps[0] < cut) stamps.shift();
  return stamps.length;
}

async function call(path, body, timeoutMs = 60000) {
  const key = process.env.EYAD_API_KEY;
  if (!key) throw Object.assign(new Error('EYAD_API_KEY is missing in server/.env'), { status: 503, code: 'NO_KEY' });
  stamps.push(Date.now());
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res;
  let text = '';
  try {
    res = await fetch(BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Store-Key': key },
      body: JSON.stringify(body || {}),
      signal: ctrl.signal,
    });
    text = await res.text();
  } catch {
    throw Object.assign(new Error('Eyad did not respond'), { code: 'NETWORK', network: true });
  } finally {
    clearTimeout(timer);
  }

  let data = {};
  let nonJson = false;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    nonJson = true;
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) data = {};

  if (!res.ok) {
    const msg = typeof data.error === 'string' && data.error ? data.error : typeof data.message === 'string' ? data.message : '';
    throw Object.assign(new Error((msg || `Eyad request failed (${res.status})`).slice(0, 200)), {
      http: res.status,
      code: String(data.code || ''),
      data,
      nonJson,
      noOrder: data.no_order === true,
      pending: data.success === true || data.verification_pending === true,
    });
  }
  return data;
}

/* ------------------------------------------------ caches (failures are never cached) */
const memo = new Map();
function cached(key, ttl, load) {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < ttl) return hit.p;
  const entry = { at: Date.now(), p: load() };
  memo.set(key, entry);
  entry.p.catch(() => {
    if (memo.get(key) === entry) memo.delete(key);
  });
  if (memo.size > 400) memo.delete(memo.keys().next().value);
  return entry.p;
}

/* ------------------------------------------------ API calls */
// { balance_usd: number | null }  (null = payment-mode account without a prepaid balance)
export const balance = () => cached('balance', 20 * 1000, () => call('/store/api/balance', {}, 30000));
export const capabilities = () => cached('caps', 60 * 60 * 1000, () => call('/store/api/capabilities', {}, 30000));
export const games = () =>
  cached('games', 30 * 60 * 1000, async () => {
    const d = await call('/store/api/games', {}, 60000);
    return Array.isArray(d.games) ? d.games : [];
  });
export const packages = (game) =>
  cached('pk:' + game, 10 * 60 * 1000, async () => {
    const d = await call('/store/api/packages', { game }, 90000);
    return Array.isArray(d.packages) ? d.packages : [];
  });
export const validate = (b) => call('/store/api/validate', b, 30000);
export const placeOrder = (b) => call('/store/api/order', b, 40000);
export const orderStatus = (reference) => call('/store/api/order/status', { payment_reference: reference }, 30000);