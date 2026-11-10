import { Router } from 'express';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import TopupOrder from '../models/TopupOrder.js';
import { notify, notifyAdmins } from '../lib/notify.js';
import { initTransaction, verifyTransaction, createRefund, secretConfigured } from '../lib/paystack.js';
import * as gd from '../lib/gamesdrop.js';
import * as ey from '../lib/eyad.js';
import { getSettings, saveSettings } from '../lib/topupSettings.js';
import { eyadRouter, placeEyad, pollEyad } from './topupsEyad.js';
import { requireAuth, requireRole, requireAdmin } from '../middleware/auth.js';

// KV-TOPUP: game coin top-ups. Flow: checkout -> Paystack payment -> provider order -> poll until delivered.
// Providers: Eyad (default, KV-EYAD) and GamesDrop. Admin picks the active one; each order remembers its own provider.
// Any failure after payment ends in an automatic Paystack refund (or an admin alert when it needs a human).

const router = Router();
const validId = (id) => mongoose.isValidObjectId(id);
const naira = (n) => '\u20A6' + Number(n || 0).toLocaleString();
const clean = (s) => String(s == null ? '' : s).trim();
const idOk = (s) => typeof s === 'string' && /^[A-Za-z0-9_.:#@-]{1,64}$/.test(s);
const offerIdOf = (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 && n < 1e12 ? n : 0;
};
const origin = () => (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',')[0];

// GamesDrop errors that mean this order can never be delivered, so the buyer is refunded straight away
const DEFINITIVE = new Set(['OFFER_NOT_FOUND', 'OUT_OF_STOCK', 'INVALID_REQUEST_BODY']);
const GD_FAILED = new Set(['CANCELED', 'CANCELLED', 'FAILED', 'REFUND']);
const GIVE_UP_MS = 45 * 60 * 1000; // stop retrying an undelivered order and refund after this long

const lim = (windowMs, max, message) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: message },
    keyGenerator: (req) => 'u:' + String(req.user && req.user._id),
  });
const validateLimit = lim(10 * 60 * 1000, 40, 'Too many checks. Wait a few minutes and try again.');
const checkoutLimit = lim(60 * 60 * 1000, 20, 'Too many top-up attempts. Try again later.');

/* ================================================================ ORDER ENGINE */

// Marks an order as needing a refund and tells the buyer. Only moves orders that are paid or being delivered.
export async function toRefund(o, buyerMsg, why, extra = {}) {
  const r = await TopupOrder.findOneAndUpdate(
    { _id: o._id, status: { $in: ['paid', 'processing'] } },
    { ...extra, status: 'refund_needed', fail_reason: buyerMsg, gd_error: String(why || '').slice(0, 120) },
    { new: true }
  );
  if (r) {
    notify(r.buyer, {
      type: 'order',
      title: 'Top-up could not be completed',
      body: `${r.product_name} ${r.offer_name}: ${buyerMsg}`.slice(0, 290),
      link: '/topup/orders',
    });
  }
  return r;
}

// Applies a GamesDrop order status to our order
async function applyGdStatus(o, gdOrderId, status, usd) {
  const s = String(status || '').toUpperCase();
  const base = { gd_status: s };
  if (gdOrderId) base.gd_order_id = Number(gdOrderId);
  if (usd) base.gd_price = usd;

  if (s === 'COMPLETED') {
    const done = await TopupOrder.findOneAndUpdate(
      { _id: o._id, status: { $in: ['paid', 'processing'] } },
      { ...base, status: 'completed', completed_at: new Date(), gd_error: '' },
      { new: true }
    );
    if (done) {
      notify(done.buyer, {
        type: 'order',
        title: 'Top-up delivered',
        body: `${done.product_name} ${done.offer_name} was added to your game account.`,
        link: '/topup/orders',
      });
    }
  } else if (GD_FAILED.has(s)) {
    await toRefund(o, 'The game could not be topped up. Your payment will be refunded.', s, base);
  } else {
    await TopupOrder.updateOne({ _id: o._id, status: { $in: ['paid', 'processing'] } }, { ...base, status: 'processing' });
  }
}

// Step 1: ask Paystack whether the buyer really paid. Returns a result to stop on, or null to carry on.
async function confirmPayment(o) {
  let tx;
  try {
    tx = await verifyTransaction(o.reference);
  } catch {
    return { ok: false, status: 502, error: 'Could not confirm the payment with Paystack yet. Try again in a moment.' };
  }

  if (tx.status !== 'success') {
    if (['failed', 'abandoned', 'reversed'].includes(tx.status)) {
      await TopupOrder.updateOne({ _id: o._id, status: 'pending' }, { status: 'failed', fail_reason: 'The payment was not completed.' });
    }
    return { ok: true, order: await TopupOrder.findById(o._id) };
  }

  if (tx.amount !== o.amount_kobo || tx.currency !== 'NGN') {
    await TopupOrder.updateOne({ _id: o._id }, { status: 'error', gd_error: 'payment amount mismatch' });
    notifyAdmins({
      type: 'order',
      title: 'Top-up payment amount mismatch',
      body: `ref ${o.reference}: expected ${o.amount_kobo} got ${tx.amount} ${tx.currency}`.slice(0, 290),
      link: '/admin',
    }).catch(() => {});
    return { ok: false, status: 409, error: 'The payment amount did not match. Our team has been notified.' };
  }

  await TopupOrder.updateOne(
    { _id: o._id, status: { $in: ['pending', 'failed'] } },
    { status: 'paid', paystack_id: String(tx.id || ''), paid_at: new Date(), fail_reason: '' }
  );
  return null;
}

// Step 2 (GamesDrop): place the order. Only one caller at a time may do this for a given order.
async function placeOrder(o) {
  const locked = await TopupOrder.findOneAndUpdate(
    {
      _id: o._id,
      status: 'paid',
      $or: [{ placing_at: null }, { placing_at: { $lt: new Date(Date.now() - 90 * 1000) } }],
    },
    { placing_at: new Date(), $inc: { attempts: 1 } },
    { new: true }
  );
  if (!locked) return;
  const test = gd.isTestOffer(locked.offer_id);

  try {
    const offer = await gd.findOne(locked.offer_id);
    const usd = Number(offer.price);
    if (!(usd > 0)) throw Object.assign(new Error('No price returned'), { code: 'SERVICE_UNAVAILABLE' });

    if (!test) {
      if (offer.currency !== 'USD') {
        await toRefund(locked, 'The pack price changed. Your payment will be refunded.', 'currency changed');
        return;
      }
      // Never deliver at a loss: if GamesDrop now costs more than the buyer paid, refund instead
      if (usd * locked.rate > locked.naira_amount) {
        await toRefund(locked, 'The pack price changed. Your payment will be refunded.', 'price rose above amount paid');
        return;
      }
    }

    const customer = {};
    if (locked.game_user_id) customer.gameUserId = locked.game_user_id;
    if (locked.game_server_id) customer.gameServerId = locked.game_server_id;

    const res = await gd.createOrder({
      offerId: locked.offer_id,
      price: usd,
      transactionId: locked.reference,
      ...(test ? {} : { useBalance: true }),
      customer,
    });
    if (!res || !res.status) throw Object.assign(new Error('Unclear GamesDrop reply'), { code: 'SERVICE_UNAVAILABLE' });
    // The activation key (test offer only) is deliberately never stored or shown
    await applyGdStatus(locked, res.order_id != null ? res.order_id : res.orderId, res.status, usd);
  } catch (e) {
    const code = e.code || (e.network ? 'NETWORK' : '');
    console.error('top-up place failed', locked.reference, code, e.message);

    if (DEFINITIVE.has(code)) {
      await toRefund(locked, 'This top-up is not available right now. Your payment will be refunded.', code);
      if (code === 'INVALID_REQUEST_BODY') {
        notifyAdmins({ type: 'order', title: 'GamesDrop rejected a top-up request', body: `ref ${locked.reference}: ${code}`, link: '/admin' }).catch(() => {});
      }
      return;
    }

    if (code === 'TRANSACTION_DUPLICATE') {
      // GamesDrop already has an order for this reference but we never saw its id: a human must check
      await TopupOrder.updateOne({ _id: locked._id }, { status: 'check_needed', gd_error: code });
      notifyAdmins({
        type: 'order',
        title: 'Top-up needs a manual check',
        body: `ref ${locked.reference}: GamesDrop reports a duplicate. Check the order in your GamesDrop dashboard.`.slice(0, 290),
        link: '/admin',
      }).catch(() => {});
      return;
    }

    const waited = Date.now() - new Date(locked.paid_at || locked.created_at).getTime();
    if (waited > GIVE_UP_MS) {
      await toRefund(locked, 'We could not deliver this top-up in time. Your payment will be refunded.', code || 'timeout');
      return;
    }

    // Temporary problem (network, low balance, service down): keep the order and let the sweep retry
    await TopupOrder.updateOne({ _id: locked._id }, { gd_error: String(code || e.message).slice(0, 120) });
    if (!locked.admin_flagged) {
      await TopupOrder.updateOne({ _id: locked._id }, { admin_flagged: true });
      notifyAdmins({
        type: 'order',
        title: code === 'INSUFFICIENT_BALANCE' ? 'GamesDrop balance too low' : 'Top-up delayed',
        body: `ref ${locked.reference}: ${code || 'temporary error'}. It will be retried automatically.`.slice(0, 290),
        link: '/admin',
      }).catch(() => {});
    }
  }
}

// Step 3 (GamesDrop): ask GamesDrop how a placed order is going
async function pollOrder(o) {
  if (!o.gd_order_id) return;
  if (o.last_polled_at && Date.now() - o.last_polled_at.getTime() < 8000) return;
  await TopupOrder.updateOne({ _id: o._id }, { last_polled_at: new Date() });
  try {
    const r = await gd.orderStatus(o.gd_order_id);
    if (r && r.status) await applyGdStatus(o, o.gd_order_id, r.status, 0);
  } catch (e) {
    console.error('top-up poll failed', o.reference, e.code || '', e.message);
  }

  const age = Date.now() - new Date(o.paid_at || o.created_at).getTime();
  if (age > 3 * 60 * 60 * 1000) {
    const fresh = await TopupOrder.findById(o._id).select('status admin_flagged');
    if (fresh && fresh.status === 'processing' && !fresh.admin_flagged) {
      await TopupOrder.updateOne({ _id: o._id }, { admin_flagged: true });
      notifyAdmins({
        type: 'order',
        title: 'Top-up taking too long',
        body: `ref ${o.reference} has been processing for over 3 hours.`,
        link: '/admin',
      }).catch(() => {});
    }
  }
}

// Each order uses the provider it was bought with, whatever the admin has selected since
const place = (o) => (o.provider === 'eyad' ? placeEyad(o) : placeOrder(o));
const poll = (o) => (o.provider === 'eyad' ? pollEyad(o) : pollOrder(o));

// Step 4: send the buyer's money back through Paystack. A failure is stored so an admin can retry it.
export async function refundOrder(o) {
  const c = await TopupOrder.findOneAndUpdate({ _id: o._id, status: 'refund_needed' }, { status: 'refunding' }, { new: true });
  if (!c) return;
  try {
    const r = await createRefund({
      transaction: c.reference,
      amount: c.amount_kobo,
      customer_note: 'KayVault top-up refund',
      merchant_note: `Top-up ${c._id} could not be delivered`,
    });
    await TopupOrder.updateOne(
      { _id: c._id },
      { status: 'refunded', refund_reference: String((r && r.id) || ''), refunded_at: new Date(), refund_error: '' }
    );
    notify(c.buyer, {
      type: 'order',
      title: 'Top-up refunded',
      body: `${naira(c.naira_amount)} for ${c.product_name} ${c.offer_name} is on its way back to you.`,
      link: '/topup/orders',
    });
  } catch (e) {
    await TopupOrder.updateOne({ _id: c._id }, { status: 'refund_failed', refund_error: String(e.message || 'Refund failed').slice(0, 200) });
    notifyAdmins({
      type: 'order',
      title: 'Top-up refund failed',
      body: `${c.product_name} ${naira(c.naira_amount)} ref ${c.reference}: ${String(e.message || '').slice(0, 150)}`.slice(0, 290),
      link: '/admin',
    }).catch(() => {});
  }
}

// Moves an order as far forward as it can go. Safe to call many times for the same reference.
export async function fulfillTopup(reference) {
  let o = await TopupOrder.findOne({ reference });
  if (!o) return { ok: false, status: 404, error: 'Order not found' };

  if (o.status === 'pending' || o.status === 'failed') {
    const r = await confirmPayment(o);
    if (r) return r;
    o = await TopupOrder.findById(o._id);
  }
  if (o.status === 'paid') {
    await place(o);
    o = await TopupOrder.findById(o._id);
  }
  if (o.status === 'processing') {
    await poll(o);
    o = await TopupOrder.findById(o._id);
  }
  if (o.status === 'refund_needed') {
    await refundOrder(o);
    o = await TopupOrder.findById(o._id);
  }
  return { ok: true, order: o };
}

// Picks up orders the buyer's page and the Paystack webhook both missed, and polls the provider for delivery
export async function sweepTopups() {
  const now = Date.now();
  await TopupOrder.updateMany(
    { status: 'refunding', updated_at: { $lt: new Date(now - 10 * 60 * 1000) } },
    { status: 'refund_failed', refund_error: 'Refund was interrupted. Check Paystack before retrying.' }
  );

  const rows = await TopupOrder.find({
    created_at: { $gt: new Date(now - 48 * 60 * 60 * 1000) },
    $or: [
      { status: 'pending', created_at: { $lt: new Date(now - 3 * 60 * 1000) } },
      { status: { $in: ['paid', 'processing', 'refund_needed'] } },
    ],
  })
    .sort({ created_at: 1 })
    .limit(25)
    .select('reference status created_at')
    .lean();

  let done = 0;
  for (const p of rows) {
    try {
      // A buyer may still be typing their card, so a young unpaid order is only picked up once Paystack says it succeeded
      if (p.status === 'pending' && now - new Date(p.created_at).getTime() < 35 * 60 * 1000) {
        const tx = await verifyTransaction(p.reference);
        if (tx.status !== 'success') continue;
      }
      const r = await fulfillTopup(p.reference);
      if (r.ok) done++;
    } catch (e) {
      console.error('top-up sweep skipped', p.reference, e.message);
    }
  }
  return done;
}

/* ================================================================ BUYER ROUTES */
router.use(requireAuth);

// KV-EYAD: while Eyad is the active provider it answers the catalog, pack, validate and checkout routes
const EYAD_PATHS = /^\/(catalog|packages|validate|checkout)(\/|$)/;
router.use(async (req, res, next) => {
  if (!EYAD_PATHS.test(req.path)) return next();
  try {
    const s = await getSettings();
    return s.provider === 'eyad' ? eyadRouter(req, res, next) : next();
  } catch (e) {
    next(e);
  }
});

// The list of games and packs, with Naira prices (GamesDrop)
router.get('/catalog', requireRole('buyer'), async (req, res, next) => {
  try {
    const rate = gd.usdNgn();
    const markup = gd.markupPercent();
    if (!gd.configured() || !rate) return res.status(503).json({ error: 'Top-ups are not set up yet' });

    const q = clean(req.query.search).slice(0, 40).toLowerCase();
    const allowed = (process.env.TOPUP_ALLOWED || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 12);

    let rows = [];
    try {
      if (allowed.length) {
        for (const term of allowed) rows = rows.concat(await gd.syncRows(term));
      } else {
        rows = await gd.syncRows(q);
      }
    } catch (e) {
      console.error('top-up catalog failed:', e.code || '', e.message);
      return res.status(502).json({ error: 'Could not load the top-up list. Try again shortly.' });
    }

    const groups = new Map();
    const seen = new Set();
    for (const r of rows) {
      const usd = Number(r.price);
      if (!r.inStock || r.currency !== 'USD' || !(usd > 0) || !r.offerGroupId || seen.has(r.offerGroupId)) continue;
      seen.add(r.offerGroupId);
      const key = String(r.productId != null ? r.productId : r.productName);
      if (!groups.has(key)) {
        groups.set(key, {
          id: key,
          name: String(r.productName || ''),
          needs_user_id: Boolean(r.isRequiredGameUserId),
          needs_server_id: Boolean(r.isRequiredGameServerId),
          packs: [],
        });
      }
      groups.get(key).packs.push({
        offer_id: r.offerGroupId,
        name: String(r.offerGroupName || ''),
        region: String(r.regionName || ''),
        naira: gd.nairaPrice(usd, rate, markup),
      });
    }

    let products = [...groups.values()].filter((g) => g.name && (!q || g.name.toLowerCase().includes(q)));
    for (const g of products) g.packs.sort((a, b) => a.naira - b.naira);
    products.sort((a, b) => a.name.localeCompare(b.name));
    products = products.slice(0, 60);

    // GamesDrop's free test offer, only while TOPUP_TEST=true
    if (process.env.TOPUP_TEST === 'true' && (!q || 'test'.includes(q))) {
      try {
        const t = await gd.findOne(999);
        if (Number(t.price) > 0) {
          products.unshift({
            id: 'test',
            name: 'TEST OFFER (no real delivery)',
            needs_user_id: true,
            needs_server_id: false,
            packs: [{ offer_id: 999, name: 'Test pack', region: '', naira: gd.nairaPrice(Number(t.price), rate, markup) }],
          });
        }
      } catch {
        /* the test offer is optional */
      }
    }

    res.json({ provider: 'gamesdrop', products });
  } catch (e) { next(e); }
});

// Servers for games that need one (for example, Europe / America / Asia)
router.get('/servers/:offerId', requireRole('buyer'), async (req, res, next) => {
  try {
    const offerId = offerIdOf(req.params.offerId);
    if (!offerId) return res.status(404).json({ error: 'Pack not found' });
    try {
      const data = await gd.servers(offerId);
      const list = Object.entries(data && typeof data === 'object' ? data : {})
        .filter(([label, value]) => typeof value === 'string' && label)
        .map(([label, value]) => ({ label: String(label).slice(0, 60), value: String(value).slice(0, 64) }));
      res.json({ servers: list });
    } catch (e) {
      console.error('top-up servers failed:', e.code || '', e.message);
      res.status(502).json({ error: 'Could not load the server list. Try again.' });
    }
  } catch (e) { next(e); }
});

// Checks a player ID so the buyer sees the nickname before paying
router.post('/validate', requireRole('buyer'), validateLimit, async (req, res, next) => {
  try {
    const offerId = offerIdOf(req.body.offer_id);
    const uid = clean(req.body.game_user_id);
    const sid = clean(req.body.game_server_id);
    if (!offerId || !idOk(uid) || (sid && !idOk(sid))) return res.status(400).json({ error: 'Enter a valid player ID' });
    try {
      const r = await gd.checkGameData({ offerId, gameUserId: uid, gameServerId: sid });
      const valid = r && r.status === 'VALID';
      res.json({ valid, player_name: valid ? String(r.gameUserLogin || '').slice(0, 80) : '' });
    } catch (e) {
      console.error('top-up validate failed:', e.code || '', e.message);
      res.status(502).json({ error: 'Could not check the player ID right now. Try again.' });
    }
  } catch (e) { next(e); }
});

// Starts a payment for one pack (GamesDrop)
router.post('/checkout', requireRole('buyer'), checkoutLimit, async (req, res, next) => {
  try {
    if (!gd.configured() || !secretConfigured() || !gd.usdNgn()) return res.status(503).json({ error: 'Top-ups are not set up yet' });

    const offerId = offerIdOf(req.body.offer_id);
    const uid = clean(req.body.game_user_id);
    const sid = clean(req.body.game_server_id);
    if (!offerId) return res.status(404).json({ error: 'Pack not found' });
    if (uid && !idOk(uid)) return res.status(400).json({ error: 'That player ID does not look right' });
    if (sid && !idOk(sid)) return res.status(400).json({ error: 'That server does not look right' });

    const open = await TopupOrder.countDocuments({
      buyer: req.user._id,
      status: 'pending',
      created_at: { $gt: new Date(Date.now() - 30 * 60 * 1000) },
    });
    if (open >= 5) return res.status(429).json({ error: 'You have several unfinished payments. Finish one or wait a few minutes.' });

    let offer;
    try {
      offer = await gd.findOne(offerId);
    } catch (e) {
      console.error('top-up find-one failed:', e.code || '', e.message);
      if (e.code === 'OFFER_NOT_FOUND') return res.status(404).json({ error: 'This pack is no longer available.' });
      return res.status(502).json({ error: 'This pack could not be loaded. Try again.' });
    }

    const test = gd.isTestOffer(offerId);
    const usd = Number(offer.price);
    if (!(usd > 0)) return res.status(409).json({ error: 'This pack is not available right now.' });
    if (!test) {
      const ok =
        offer.currency === 'USD' &&
        offer.isReturnDataForCustomer === false && // direct top-ups only, never keys
        offer.isSettlementCompatible !== false &&
        offer.available !== 0;
      if (!ok) return res.status(409).json({ error: 'This pack is not available right now.' });
    }

    if (offer.isRequiredGameUserId && !uid) return res.status(400).json({ error: 'Enter your player ID' });
    if (offer.isRequiredGameServerId && !sid) return res.status(400).json({ error: 'Choose your server' });

    let player = '';
    if (offer.isRequiredGameUserId) {
      try {
        const c = await gd.checkGameData({ offerId, gameUserId: uid, gameServerId: sid });
        if (!c || c.status !== 'VALID') return res.status(400).json({ error: 'We could not find that player ID. Check it and try again.' });
        player = String(c.gameUserLogin || '').slice(0, 80);
      } catch (e) {
        console.error('top-up check failed:', e.code || '', e.message);
        return res.status(502).json({ error: 'Could not check the player ID right now. Try again.' });
      }
    }

    const rate = gd.usdNgn();
    const markup = gd.markupPercent();
    const amount = gd.nairaPrice(usd, rate, markup);
    if (req.body.expected_naira != null && Number(req.body.expected_naira) !== amount) {
      return res.status(409).json({ error: `The price changed to ${naira(amount)}. Check it and try again.`, code: 'price_changed', naira: amount });
    }
    const kobo = Math.round(amount * 100);
    const reference = 'tp_' + crypto.randomBytes(12).toString('hex');

    const order = await TopupOrder.create({
      reference,
      provider: 'gamesdrop',
      buyer: req.user._id,
      offer_id: offerId,
      product_name: String(offer.productName || '').slice(0, 120),
      offer_name: String(offer.offerName || '').slice(0, 120),
      game_user_id: uid,
      game_server_id: sid,
      player_name: player,
      usd_price: usd,
      rate,
      markup_percent: markup,
      naira_amount: amount,
      amount_kobo: kobo,
      status: 'pending',
    });

    try {
      const tx = await initTransaction({
        email: req.user.email,
        amount: kobo,
        currency: 'NGN',
        reference,
        callback_url: `${origin()}/topup/callback`,
        metadata: { topup_id: String(order._id), buyer_id: String(req.user._id) },
      });
      res.json({ authorization_url: tx.authorization_url, reference });
    } catch (err) {
      await TopupOrder.updateOne({ _id: order._id }, { status: 'failed', fail_reason: 'Could not start the payment.' });
      console.error('Paystack initialize failed (top-up):', err.message);
      res.status(502).json({ error: 'Could not start the payment. Please try again.' });
    }
  } catch (e) { next(e); }
});

// The buyer's page calls this after Paystack, and keeps calling it until the order is finished
router.post('/verify', requireRole('buyer'), async (req, res, next) => {
  try {
    const reference = typeof req.body.reference === 'string' ? req.body.reference.slice(0, 80) : '';
    const mine = reference && (await TopupOrder.findOne({ reference, buyer: req.user._id }).select('_id'));
    if (!mine) return res.status(404).json({ error: 'Order not found' });

    const r = await fulfillTopup(reference);
    if (!r.ok) return res.status(r.status || 400).json({ error: r.error });
    res.json({ order: r.order });
  } catch (e) { next(e); }
});

router.get('/mine', requireRole('buyer'), async (req, res, next) => {
  try {
    const rows = await TopupOrder.find({ buyer: req.user._id }).sort({ created_at: -1 }).limit(100);
    res.json(rows);
  } catch (e) { next(e); }
});

/* ================================================================ ADMIN ROUTES */
router.get('/admin/overview', requireAdmin, async (_req, res, next) => {
  try {
    let bal = null;
    let balError = '';
    if (gd.configured()) {
      try {
        const b = await gd.balance();
        bal = {
          amount: Number(b.balance),
          reserved: Number(b.draft_balance || 0),
          currency: (b.currency && b.currency.code) || 'USD',
          postpaid: Boolean(b.is_postpaid),
        };
      } catch (e) {
        balError = e.code || 'Could not read the GamesDrop balance';
      }
    } else {
      balError = 'GAMESDROP_TOKEN is not set';
    }

    let eyadBalance = null;
    let eyadError = '';
    if (ey.configured()) {
      try {
        const b = await ey.balance();
        eyadBalance = b.balance_usd == null ? null : Number(b.balance_usd);
      } catch (e) {
        eyadError = e.code || (e.http ? 'Eyad answered ' + e.http : 'Could not read the Eyad balance');
      }
    } else {
      eyadError = 'EYAD_API_KEY is not set';
    }

    const settings = await getSettings();
    const rows = await TopupOrder.find().sort({ created_at: -1 }).limit(100).populate('buyer', 'email full_name').lean();
    const orders = rows.map((r) => ({
      id: String(r._id),
      reference: r.reference,
      provider: r.provider || 'gamesdrop',
      buyer_email: (r.buyer && r.buyer.email) || '',
      buyer_name: (r.buyer && r.buyer.full_name) || '',
      product_name: r.product_name,
      offer_name: r.offer_name,
      game_user_id: r.game_user_id,
      game_server_id: r.game_server_id,
      zone_id: r.zone_id || '',
      player_name: r.player_name,
      naira_amount: r.naira_amount,
      usd_price: r.usd_price,
      gd_price: r.eyad_charged || r.gd_price,
      status: r.status,
      gd_status: r.eyad_status || r.gd_status,
      gd_error: r.gd_error,
      fail_reason: r.fail_reason,
      refund_error: r.refund_error,
      attempts: r.attempts,
      created_at: r.created_at,
      paid_at: r.paid_at,
      completed_at: r.completed_at,
      refunded_at: r.refunded_at,
    }));
    const attention = ['paid', 'refund_needed', 'refund_failed', 'check_needed', 'error'];
    res.json({
      settings,
      balance: bal,
      balance_error: balError,
      eyad: { configured: ey.configured(), balance_usd: eyadBalance, error: eyadError },
      rate: gd.usdNgn(),
      markup: gd.markupPercent(),
      test_mode: process.env.TOPUP_TEST === 'true',
      needs_attention: orders.filter((o) => attention.includes(o.status)).length,
      orders,
    });
  } catch (e) { next(e); }
});

// KV-EYAD: provider, Naira rate and profit % (and the optional list of Eyad games to sell)
router.get('/admin/settings', requireAdmin, async (_req, res, next) => {
  try {
    res.json({ settings: await getSettings(true), eyad_configured: ey.configured(), gamesdrop_configured: gd.configured() });
  } catch (e) { next(e); }
});

router.post('/admin/settings', requireAdmin, async (req, res, next) => {
  try {
    const r = await saveSettings(req.body && typeof req.body === 'object' ? req.body : {});
    if (r.error) return res.status(400).json({ error: r.error });
    res.json({ settings: r.settings });
  } catch (e) { next(e); }
});

// Refund the buyer. Allowed for orders that are stuck or failed, never for one that is still being delivered.
router.post('/admin/:id/refund', requireAdmin, async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ error: 'Order not found' });
    const o = await TopupOrder.findById(req.params.id);
    if (!o) return res.status(404).json({ error: 'Order not found' });
    if (!['paid', 'refund_needed', 'refund_failed', 'check_needed'].includes(o.status)) {
      return res.status(409).json({ error: 'This order cannot be refunded from its current state.' });
    }
    if (o.status !== 'refund_needed') {
      o.status = 'refund_needed';
      if (!o.fail_reason) o.fail_reason = 'Refunded by KayVault support.';
      await o.save();
    }
    await refundOrder(o);
    const fresh = await TopupOrder.findById(o._id).select('status');
    res.json({ ok: true, status: fresh && fresh.status });
  } catch (e) { next(e); }
});

// Try again to place a paid order that is waiting (for example after you topped up your provider balance)
router.post('/admin/:id/retry', requireAdmin, async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ error: 'Order not found' });
    const o = await TopupOrder.findOneAndUpdate({ _id: req.params.id, status: 'paid' }, { placing_at: null }, { new: true });
    if (!o) return res.status(409).json({ error: 'Only paid orders that are waiting can be retried.' });
    await place(o);
    const fresh = await TopupOrder.findById(o._id).select('status');
    res.json({ ok: true, status: fresh && fresh.status });
  } catch (e) { next(e); }
});

// After checking the provider yourself: mark a "needs a check" order as delivered
router.post('/admin/:id/complete', requireAdmin, async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ error: 'Order not found' });
    const o = await TopupOrder.findOneAndUpdate(
      { _id: req.params.id, status: 'check_needed' },
      { status: 'completed', completed_at: new Date(), gd_status: 'COMPLETED (confirmed by admin)' },
      { new: true }
    );
    if (!o) return res.status(409).json({ error: 'Only orders that need a check can be marked delivered.' });
    notify(o.buyer, {
      type: 'order',
      title: 'Top-up delivered',
      body: `${o.product_name} ${o.offer_name} was added to your game account.`,
      link: '/topup/orders',
    });
    res.json({ ok: true, status: o.status });
  } catch (e) { next(e); }
});

export default router;