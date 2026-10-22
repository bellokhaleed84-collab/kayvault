import crypto from 'node:crypto';

const BASE = 'https://api.paystack.co';

function secret() {
  const k = process.env.PAYSTACK_SECRET_KEY;
  if (!k) throw Object.assign(new Error('PAYSTACK_SECRET_KEY is missing in server/.env'), { status: 503 });
  return k;
}

async function call(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { Authorization: `Bearer ${secret()}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status === false) {
    throw Object.assign(new Error(data.message || 'Paystack request failed'), { status: 502 });
  }
  return data.data;
}

export const secretConfigured = () => Boolean(process.env.PAYSTACK_SECRET_KEY);
// Full or partial refund. transaction = the payment reference, amount in kobo.
export const createRefund = (body) => call('POST', '/refund', body);

// KV-PS-BANKS: Nigerian bank list from Paystack, cached for 6 hours
let bankCache = { at: 0, list: [] };
export async function nigerianBanks() {
  const fresh = bankCache.list.length > 0 && Date.now() - bankCache.at < 6 * 60 * 60 * 1000;
  if (fresh) return bankCache.list;
  try {
    const rows = await call('GET', '/bank?country=nigeria&perPage=200&use_cursor=false');
    const seen = new Set();
    const list = [];
    for (const r of Array.isArray(rows) ? rows : []) {
      const name = typeof r.name === 'string' ? r.name.trim() : '';
      if (!name || r.active === false || r.is_deleted === true || seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      list.push({ name, code: String(r.code || '') });
    }
    list.sort((x, y) => x.name.localeCompare(y.name));
    if (list.length) bankCache = { at: Date.now(), list };
  } catch (e) {
    if (!bankCache.list.length) throw e;
  }
  if (!bankCache.list.length) throw new Error('Bank list is empty');
  return bankCache.list;
}
export const initTransaction = (body) => call('POST', '/transaction/initialize', body);
export const verifyTransaction = (reference) =>
  call('GET', `/transaction/verify/${encodeURIComponent(reference)}`);

// Percentage KayVault keeps from each sale (PLATFORM_FEE_PERCENT in server/.env, default 12)
export function feePercent() {
  const n = Number(process.env.PLATFORM_FEE_PERCENT);
  return Number.isFinite(n) && n >= 0 && n <= 50 ? n : 12;
}

// Paystack signs webhooks with HMAC SHA512 of the raw body
export function validSignature(rawBody, signature) {
  if (!rawBody || !signature) return false;
  const hash = crypto.createHmac('sha512', secret()).update(rawBody).digest('hex');
  const a = Buffer.from(hash);
  const b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}