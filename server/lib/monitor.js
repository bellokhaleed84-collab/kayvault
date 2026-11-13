// KV-MONITOR v1: numbers for the admin Monitor tab. Read only: it never sends money or changes data.
import mongoose from 'mongoose';
import Purchase from '../models/Purchase.js';
import TopupOrder from '../models/TopupOrder.js';
import * as eyad from './eyad.js';
import { cloudConfigured } from './cloudinary.js';
import { secretConfigured } from './paystack.js';

/* ------------------------------------------------ request tracking (memory only, resets when the server restarts) */
const startedAt = Date.now();
const counts = { requests: 0, errors: 0, slow: 0, totalMs: 0 };
const lastErrors = [];
const slowest = [];
const keep = (list, item, max = 15) => {
  list.unshift(item);
  if (list.length > max) list.length = max;
};
// Keeps the route but hides ids and anything that looks like a token
const cleanPath = (u) =>
  String(u || '')
    .split('?')[0]
    .split('/')
    .map((s) => (/^[0-9a-f]{24}$/i.test(s) || s.length > 24 ? ':id' : s))
    .join('/')
    .slice(0, 120);

export function trackRequests(req, res, next) {
  if (req.path === '/api/health') return next();
  const t0 = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    counts.requests += 1;
    counts.totalMs += ms;
    if (res.statusCode >= 500) counts.errors += 1;
    if (ms > 2000) {
      counts.slow += 1;
      keep(slowest, { method: req.method, path: cleanPath(req.originalUrl), ms: Math.round(ms), status: res.statusCode, at: new Date().toISOString() });
    }
  });
  next();
}

export function noteError(req, err) {
  keep(lastErrors, {
    method: req.method,
    path: cleanPath(req.originalUrl),
    message: String((err && err.message) || err || 'Error').slice(0, 160),
    at: new Date().toISOString(),
  });
}

/* ------------------------------------------------ helpers */
const r1 = (n) => Math.round(n * 10) / 10;
const REAL = { payment_reference: { $exists: true, $nin: [null, ''] } };
const safe = (p, fallback) => Promise.resolve(p).catch(() => fallback);

async function timed(fn, limitMs = 10000) {
  const t0 = Date.now();
  let timer;
  try {
    const value = await Promise.race([
      fn(),
      new Promise((_, rej) => {
        timer = setTimeout(() => rej(new Error('No answer after ' + Math.round(limitMs / 1000) + ' seconds')), limitMs);
      }),
    ]);
    return { ok: true, ms: Date.now() - t0, value };
  } catch (e) {
    return { ok: false, ms: Date.now() - t0, error: String((e && e.message) || e).slice(0, 160) };
  } finally {
    clearTimeout(timer);
  }
}

const sumField = (match, field) =>
  Purchase.aggregate([
    { $match: { ...REAL, ...match } },
    { $group: { _id: null, sum: { $sum: { $ifNull: [field, 0] } } } },
  ]).then((r) => r[0]?.sum || 0);

/* ------------------------------------------------ outside services */
async function paystackBalance() {
  const res = await fetch('https://api.paystack.co/balance', {
    headers: { Authorization: 'Bearer ' + process.env.PAYSTACK_SECRET_KEY },
    signal: AbortSignal.timeout(10000),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok || d.status === false) throw new Error(d.message || 'Paystack ' + res.status);
  const ngn = (Array.isArray(d.data) ? d.data : []).find((b) => b.currency === 'NGN');
  return { naira: ngn ? Math.round(Number(ngn.balance) / 100) : 0 };
}

let cloudCache = { at: 0, p: null };
function cloudUsage() {
  if (cloudCache.p && Date.now() - cloudCache.at < 10 * 60 * 1000) return cloudCache.p;
  const auth = Buffer.from(process.env.CLOUDINARY_API_KEY + ':' + process.env.CLOUDINARY_API_SECRET).toString('base64');
  const p = (async () => {
    const res = await fetch('https://api.cloudinary.com/v1_1/' + process.env.CLOUDINARY_CLOUD_NAME + '/usage', {
      headers: { Authorization: 'Basic ' + auth },
      signal: AbortSignal.timeout(10000),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((d && d.error && d.error.message) || 'Cloudinary ' + res.status);
    return {
      plan: typeof d.plan === 'string' ? d.plan : '',
      storage_mb: d.storage && Number.isFinite(Number(d.storage.usage)) ? r1(Number(d.storage.usage) / 1048576) : null,
      credits_used: d.credits && d.credits.usage != null ? Number(d.credits.usage) : null,
      credits_limit: d.credits && d.credits.limit != null ? Number(d.credits.limit) : null,
      credits_percent: d.credits && d.credits.used_percent != null ? Number(d.credits.used_percent) : null,
    };
  })();
  cloudCache = { at: Date.now(), p };
  p.catch(() => { if (cloudCache.p === p) cloudCache = { at: 0, p: null }; });
  return p;
}

/* ------------------------------------------------ database space */
async function collectionSizes(db) {
  const list = await db.listCollections({}, { nameOnly: true }).toArray();
  const rows = await Promise.all(
    list.slice(0, 60).map(async (c) => {
      try {
        const r = await db.collection(c.name).aggregate([{ $collStats: { storageStats: {} } }]).toArray();
        const s = (r[0] && r[0].storageStats) || {};
        return { name: c.name, bytes: (s.storageSize || 0) + (s.totalIndexSize || 0), count: s.count || 0 };
      } catch {
        return null;
      }
    })
  );
  return rows
    .filter(Boolean)
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 8)
    .map((r) => ({ name: r.name, mb: r1(r.bytes / 1048576), count: r.count }));
}

async function dbSpace() {
  const db = mongoose.connection.db;
  const st = await db.command({ dbStats: 1, scale: 1 });
  const usedBytes = (st.storageSize || 0) + (st.indexSize || 0);
  const limit = Number(process.env.MONGO_LIMIT_MB) || 512; // free Atlas plan is 512 MB. Set MONGO_LIMIT_MB on Render if you pay for more.
  return {
    used_mb: r1(usedBytes / 1048576),
    limit_mb: limit,
    data_mb: r1((st.dataSize || 0) / 1048576),
    index_mb: r1((st.indexSize || 0) / 1048576),
    collections: st.collections || 0,
    objects: st.objects || 0,
    top: await safe(collectionSizes(db), []),
  };
}

/* ------------------------------------------------ the snapshot */
let snap = { at: 0, data: null, p: null };

async function build() {
  const hasPs = secretConfigured();
  const hasEyad = eyad.configured();
  const hasCloud = cloudConfigured();
  const dbUp = mongoose.connection.readyState === 1;

  const [dbPing, ps, ey, cl, space, owed, requested, escrowed, topupAttn] = await Promise.all([
    timed(() => mongoose.connection.db.command({ ping: 1 })),
    hasPs ? timed(paystackBalance) : null,
    hasEyad ? timed(() => eyad.balance()) : null,
    hasCloud ? timed(cloudUsage) : null,
    dbUp ? timed(dbSpace, 20000) : null,
    safe(sumField({ escrow_status: 'released', payout_status: { $nin: ['paid', 'requested'] } }, '$seller_amount'), 0),
    safe(sumField({ escrow_status: 'released', payout_status: 'requested' }, '$seller_amount'), 0),
    safe(sumField({ escrow_status: { $in: ['held', 'refund_requested'] } }, '$price'), 0),
    safe(TopupOrder.countDocuments({ status: { $in: ['refund_needed', 'refund_failed', 'check_needed'] } }), 0),
  ]);

  const line = (key, name, r, okDetail) => ({ key, name, status: r.ok ? 'up' : 'down', ms: r.ms, detail: r.ok ? okDetail || '' : r.error });
  const off = (key, name, detail) => ({ key, name, status: 'off', ms: null, detail });

  const pk = process.env.PAYSTACK_SECRET_KEY || '';
  const psMode = pk.startsWith('sk_live') ? 'live' : pk.startsWith('sk_test') ? 'test' : 'unknown';

  const services = [
    dbUp ? line('database', 'Database (MongoDB)', dbPing) : { key: 'database', name: 'Database (MongoDB)', status: 'down', ms: null, detail: 'Not connected' },
    hasPs ? line('paystack', 'Paystack payments', ps, psMode + ' mode') : off('paystack', 'Paystack payments', 'Key not set'),
    hasEyad ? line('eyad', 'Eyad top-ups', ey, eyad.used() + ' of 60 calls used this minute') : off('eyad', 'Eyad top-ups', 'Key not set'),
    hasCloud ? line('cloudinary', 'Cloudinary files', cl) : off('cloudinary', 'Cloudinary files', 'Not set up'),
    process.env.RESEND_API_KEY ? { key: 'email', name: 'Email (Resend)', status: 'up', ms: null, detail: 'Key is set. Not tested.' } : off('email', 'Email (Resend)', 'Key not set'),
  ];

  const psNaira = ps && ps.ok ? ps.value.naira : null;
  const owe = owed + requested;

  return {
    at: new Date().toISOString(),
    server: {
      uptime_s: Math.round((Date.now() - startedAt) / 1000),
      node: process.version,
      memory_mb: Math.round(process.memoryUsage().rss / 1048576),
      requests: counts.requests,
      errors: counts.errors,
      slow_count: counts.slow,
      avg_ms: counts.requests ? Math.round(counts.totalMs / counts.requests) : 0,
      last_errors: lastErrors,
      slow: slowest,
    },
    services,
    storage: {
      db: space && space.ok ? space.value : null,
      db_error: space && !space.ok ? space.error : '',
      cloud: cl && cl.ok ? cl.value : null,
      cloud_error: cl && !cl.ok ? cl.error : '',
    },
    money: {
      eyad_usd: ey && ey.ok ? ey.value.balance_usd ?? null : undefined,
      eyad_ok: Boolean(ey && ey.ok),
      paystack_naira: psNaira,
      paystack_mode: psMode,
      owed,
      requested,
      escrow: escrowed,
      topups_attention: topupAttn,
      covered: psNaira == null ? null : psNaira >= owe,
    },
  };
}

export function monitorSnapshot() {
  if (snap.data && Date.now() - snap.at < 20 * 1000) return Promise.resolve(snap.data);
  if (snap.p) return snap.p;
  snap.p = build()
    .then((d) => {
      snap = { at: Date.now(), data: d, p: null };
      return d;
    })
    .catch((e) => {
      snap.p = null;
      throw e;
    });
  return snap.p;
}