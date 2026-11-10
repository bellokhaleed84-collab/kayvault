// KV-TOPUP: thin client for the GamesDrop partner API.
// The token only ever comes from server/.env (GAMESDROP_TOKEN) and is never logged or sent to the browser.
const BASE = 'https://partner.gamesdrop.io';

const KNOWN_CODES = [
  'INVALID_TOKEN', 'OFFER_NOT_FOUND', 'TRANSACTION_DUPLICATE', 'WRONG_PRICE', 'ORDER_NOT_FOUND',
  'ORDER_NOT_PROCESSING', 'ORDER_NOT_COMPLETED', 'ORDER_ALREADY_CANCELED', 'ORDER_ALREADY_REFUNDED',
  'SERVICE_UNAVAILABLE', 'INVALID_REQUEST_BODY', 'INSUFFICIENT_BALANCE', 'BALANCE_UNAVAILABLE', 'OUT_OF_STOCK',
];

export const configured = () => Boolean(process.env.GAMESDROP_TOKEN);

function authHeaders() {
  const t = process.env.GAMESDROP_TOKEN;
  if (!t) throw Object.assign(new Error('GAMESDROP_TOKEN is missing in server/.env'), { status: 503, code: 'NO_TOKEN' });
  return { Authorization: t, 'Content-Type': 'application/json' };
}

async function call(method, path, body) {
  const headers = authHeaders();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  let res;
  let text = '';
  try {
    res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: ctrl.signal });
    text = await res.text();
  } catch {
    throw Object.assign(new Error('GamesDrop did not respond'), { status: 502, code: 'NETWORK', network: true });
  } finally {
    clearTimeout(timer);
  }

  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: String(text).slice(0, 200) };
  }

  if (!res.ok) {
    const hay = JSON.stringify(data).toUpperCase();
    let code = KNOWN_CODES.find((c) => hay.includes(c)) || '';
    if (!code && (res.status === 401 || res.status === 403)) code = 'INVALID_TOKEN';
    const msg = data && (data.message || data.error);
    throw Object.assign(
      new Error(typeof msg === 'string' && msg ? msg.slice(0, 200) : `GamesDrop request failed (${res.status})`),
      { status: 502, code, http: res.status }
    );
  }
  return data;
}

/* ------------------------------------------------ API calls */
export const balance = () => call('GET', '/api/v1/partner/balance');
export const findOne = (offerId) => call('POST', '/api/v1/offers/find-one', { offerId: Number(offerId) });
export const servers = (offerId) => call('POST', '/api/v1/partner/product-offer/servers', { offerId: Number(offerId) });
export const createOrder = (body) => call('POST', '/api/v1/offers/create-order', body);
export const orderStatus = (orderId) => call('POST', '/api/v1/offers/order-status', { orderId: Number(orderId) });
export const checkGameData = ({ offerId, gameUserId, gameServerId }) =>
  call('POST', '/api/v1/offers/check-game-data', {
    offerId: Number(offerId),
    gameUserId: String(gameUserId || ''),
    ...(gameServerId ? { gameServerId: String(gameServerId) } : {}),
  });

// Catalogue of direct top-ups, cached for 10 minutes per search term
const cache = new Map();
export async function syncRows(term) {
  const key = String(term || '').trim().toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 10 * 60 * 1000) return hit.rows;
  const data = await call('POST', '/api/v1/offers/sync', {
    limit: 1000,
    page: 1,
    category: 'Top Up',
    ...(key ? { search: key } : {}),
  });
  const rows = Array.isArray(data.rows) ? data.rows : [];
  cache.set(key, { at: Date.now(), rows });
  if (cache.size > 50) cache.delete(cache.keys().next().value);
  return rows;
}

/* ------------------------------------------------ pricing (Naira) */
// GamesDrop charges in USD. GAMESDROP_USD_NGN is the Naira you pay per dollar, set by you in server/.env.
export function usdNgn() {
  const n = Number(process.env.GAMESDROP_USD_NGN);
  return Number.isFinite(n) && n >= 100 && n <= 20000 ? n : 0;
}

// TOPUP_MARKUP_PERCENT is your margin on top of the converted price (default 10)
export function markupPercent() {
  const raw = process.env.TOPUP_MARKUP_PERCENT;
  const n = Number(raw);
  return raw !== undefined && raw !== '' && Number.isFinite(n) && n >= 0 && n <= 100 ? n : 10;
}

// Rounded up to the next 10 Naira
export function nairaPrice(usd, rate = usdNgn(), markup = markupPercent()) {
  return Math.ceil((Number(usd) * rate * (1 + markup / 100)) / 10 - 1e-9) * 10;
}

// GamesDrop's free test offer. Only works while TOPUP_TEST=true is in server/.env.
export const isTestOffer = (offerId) => Number(offerId) === 999 && process.env.TOPUP_TEST === 'true';
