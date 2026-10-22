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