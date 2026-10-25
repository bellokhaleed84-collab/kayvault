// KV-TRANSFERS v1
// Paystack Transfers (sending money to a bank account), plain fetch.
const BASE = 'https://api.paystack.co';

async function call(method, path, body) {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw Object.assign(new Error('PAYSTACK_SECRET_KEY is missing in server/.env'), { status: 503 });
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 25000);
  try {
    const res = await fetch(BASE + path, {
      method,
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctl.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.status === false) {
      throw Object.assign(new Error(data.message || 'Paystack request failed'), { status: res.ok ? 400 : res.status });
    }
    return data.data;
  } finally {
    clearTimeout(timer);
  }
}

export const createRecipient = (body) => call('POST', '/transferrecipient', body);
export const initiateTransfer = (body) => call('POST', '/transfer', body);
export const verifyTransfer = (reference) => call('GET', '/transfer/verify/' + encodeURIComponent(reference));