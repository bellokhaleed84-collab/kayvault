// KV-EYAD v1: Eyad provider for game top-ups.
// Buyer routes (catalog, packages, validate, checkout) plus the order engine (placeEyad / pollEyad).
// topups.js hands requests here while Eyad is the active provider, and calls the engine for Eyad orders.
import { Router } from 'express';
import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';
import TopupOrder from '../models/TopupOrder.js';
import { notify, notifyAdmins } from '../lib/notify.js';
import { initTransaction, secretConfigured } from '../lib/paystack.js';
import * as ey from '../lib/eyad.js';
import { getSettings, nairaPrice } from '../lib/topupSettings.js';
import { requireRole } from '../middleware/auth.js';
import { toRefund } from './topups.js';

const naira = (n) => '\u20A6' + Number(n || 0).toLocaleString();
const clean = (s) => String(s == null ? '' : s).trim();
const origin = () => (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',')[0];

const GIVE_UP_MS = 45 * 60 * 1000; // stop retrying an order that cannot be placed and refund after this long
const PLAYER_OK = /^[^\u0000-\u001f\u007f]{1,190}$/;
const FIELD_OK = /^[A-Za-z0-9_.:#@-]{1,64}$/;
const GAME_OK = /^[a-z0-9_]{1,60}$/;
// Refusals that are about our account, not about the order: keep the paid order and retry later
const TEMP_RX = /INSUFFICIENT|DAILY SPEND|BALANCE|ACCOUNT_POLICY|API KEY|NOT AUTHORIZED|DEMO KEYS/i;

const lim = (windowMs, max, message) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: message },
    keyGenerator: (req) => 'u:' + String(req.user && req.user._id),
  });
const validateLimit = lim(10 * 60 * 1000, 30, 'Too many checks. Wait a few minutes and try again.');
const checkoutLimit = lim(60 * 60 * 1000, 20, 'Too many top-up attempts. Try again later.');

export const eyadRouter = Router();

/* ================================================================ ORDER ENGINE */

function bodyFor(o, ref) {
  // Identical on every retry of the same reference (Eyad refuses a changed body)
  return {
    game: o.game_id,
    package_id: o.package_id,
    user_id: o.game_user_id,
    ...(o.game_server_id ? { server: o.game_server_id } : {}),
    ...(o.zone_id ? { zone_id: o.zone_id } : {}),
    payment_reference: ref,
    max_charge_usd: o.max_charge_usd,
    allow_fallback: false,
    fallback_max_pct: 30,
  };
}

async function lookup(o) {
  try {
    return { kind: 'found', data: await ey.orderStatus(o.eyad_ref || o.reference) };
  } catch (e) {
    if (e.http === 404) return { kind: 'notfound' };
    console.error('eyad status failed', o.reference, e.code || e.http || '', e.message);
    return { kind: 'error' };
  }
}

const release = (o) => TopupOrder.updateOne({ _id: o._id, status: 'paid' }, { placing_at: null });

// A refusal about our own account (balance, key, spending cap). The paid order waits and is retried.
async function tempFail(o, why, newRef) {
  const waited = Date.now() - new Date(o.paid_at || o.created_at).getTime();
  if (waited > GIVE_UP_MS) {
    await toRefund(o, 'We could not deliver this top-up in time. Your payment will be refunded.', String(why).slice(0, 100));
    return;
  }
  const upd = { placing_at: null, gd_error: String(why).slice(0, 120) };
  // A refused reference is remembered by Eyad, so a retry needs a fresh one
  if (newRef) {
    upd.eyad_ref = o.reference + '-r' + (Number(o.attempts) || 1);
    upd.eyad_sent = false;
  }
  await TopupOrder.updateOne({ _id: o._id, status: 'paid' }, upd);
  if (!o.admin_flagged) {
    await TopupOrder.updateOne({ _id: o._id }, { admin_flagged: true });
    notifyAdmins({
      type: 'order',
      title: /INSUFFICIENT|BALANCE/i.test(why) ? 'Eyad balance too low' : 'Top-up delayed',
      body: `ref ${o.reference}: ${String(why).slice(0, 120)}. It will be retried automatically.`.slice(0, 290),
      link: '/admin',
    }).catch(() => {});
  }
}

// Applies an Eyad answer (order or status endpoint) to our order
async function applyStatus(o, d) {
  const st = String(d.status || '').toLowerCase();
  const base = { eyad_status: st.toUpperCase().slice(0, 30) };
  if (d.order_id) base.eyad_order_id = String(d.order_id).slice(0, 80);
  if (typeof d.charged_usd === 'number') base.eyad_charged = d.charged_usd;

  if (st === 'completed') {
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
    return;
  }

  if (st === 'failed') {
    // Eyad reports failed only after any charge was returned to our balance
    const why = String(d.code || '') + ' ' + String(d.error || d.message || '');
    if (d.no_order === true && TEMP_RX.test(why)) return tempFail(o, why.trim() || 'account problem', true);
    await toRefund(o, 'The game could not be topped up. Your payment will be refunded.', ('eyad ' + why).trim(), base);
    return;
  }

  // processing, unknown or anything unfamiliar: never treat it as a failure, keep waiting
  await TopupOrder.updateOne(
    { _id: o._id, status: { $in: ['paid', 'processing'] } },
    { ...base, status: 'processing', placing_at: o.placing_at || new Date() }
  );
}

async function onSendError(o, ref, e) {
  const http = e.http || 0;
  const why = (String(e.code || '') + ' ' + String(e.message || '')).trim();
  console.error('eyad place failed', o.reference, http, why.slice(0, 120));

  // The order may exist (timeout, 5xx, still running): wait and look it up by reference. Never refund here.
  if (e.network || e.pending || e.nonJson || (http >= 500 && !e.noOrder)) {
    await TopupOrder.updateOne(
      { _id: o._id, status: 'paid' },
      { status: 'processing', eyad_status: 'UNCONFIRMED', placing_at: new Date(), last_polled_at: null }
    );
    return;
  }
  if (http === 503 || http === 429) return release(o); // nothing happened: same reference, try again soon

  if (/REFERENCE_CONFLICT/.test(e.code || '')) {
    await TopupOrder.updateOne({ _id: o._id }, { status: 'check_needed', gd_error: 'REFERENCE_CONFLICT' });
    notifyAdmins({ type: 'order', title: 'Top-up needs a manual check', body: `ref ${o.reference}: Eyad reports a reference conflict.`, link: '/admin' }).catch(() => {});
    return;
  }
  if (http === 401 || http === 402 || http === 403 || TEMP_RX.test(why)) return tempFail(o, why || 'account problem', true);

  await toRefund(o, 'This top-up is not available right now. Your payment will be refunded.', ('eyad ' + why).slice(0, 100));
}

// Step 2 for Eyad: place the order. Only one caller at a time may do this for a given order.
export async function placeEyad(o) {
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

  try {
    const ref = locked.eyad_ref || locked.reference;
    if (locked.eyad_sent) {
      // An earlier send with this reference may have reached Eyad: look before sending again
      const look = await lookup(locked);
      if (look.kind === 'found') return await applyStatus(locked, look.data);
      if (look.kind === 'error') return await release(locked);
    }
    await TopupOrder.updateOne({ _id: locked._id }, { eyad_sent: true, eyad_ref: ref });

    let r;
    try {
      r = await ey.placeOrder(bodyFor(locked, ref));
    } catch (e) {
      return await onSendError(locked, ref, e);
    }
    await applyStatus(locked, r);
  } catch (e) {
    console.error('eyad place error', locked.reference, e.message);
    await release(locked).catch(() => {});
  }
}

// Step 3 for Eyad: ask how a placed order is going (by our reference, so it also works before we know the order id)
export async function pollEyad(o) {
  if (o.last_polled_at && Date.now() - o.last_polled_at.getTime() < 12000) return;
  if (ey.used() > 45) return; // keep room under Eyad's 60 calls per minute
  await TopupOrder.updateOne({ _id: o._id }, { last_polled_at: new Date() });

  const look = await lookup(o);
  if (look.kind === 'found') {
    await applyStatus(o, look.data);
  } else if (look.kind === 'notfound') {
    const since = new Date(o.placing_at || o.paid_at || o.created_at).getTime();
    // Nothing recorded after a few minutes: send the identical request again (the same reference never buys twice)
    if (Date.now() - since > 3 * 60 * 1000) {
      await TopupOrder.updateOne({ _id: o._id, status: 'processing' }, { status: 'paid', placing_at: null });
    }
  }

  const age = Date.now() - new Date(o.paid_at || o.created_at).getTime();
  if (age > 3 * 60 * 60 * 1000) {
    const fresh = await TopupOrder.findById(o._id).select('status admin_flagged');
    if (fresh && fresh.status === 'processing' && !fresh.admin_flagged) {
      await TopupOrder.updateOne({ _id: o._id }, { admin_flagged: true });
      notifyAdmins({ type: 'order', title: 'Top-up taking too long', body: `ref ${o.reference} has been processing for over 3 hours.`, link: '/admin' }).catch(() => {});
    }
  }
}

/* ================================================================ BUYER ROUTES (Eyad) */

async function findGame(id, s) {
  const list = await ey.games();
  const g = list.find((x) => x && x.id === id);
  if (!g) return null;
  if (s.eyad_games.length && !s.eyad_games.includes(id)) return null;
  return g;
}

function gameJson(g) {
  return {
    id: String(g.id),
    name: String(g.name || ''),
    id_label: String(g.id_label || 'Player ID'),
    id_format: g.id_format ? String(g.id_format) : '',
    requires_server: Boolean(g.requires_server),
    requires_zone: Boolean(g.requires_zone),
    zone_label: g.zone_label ? String(g.zone_label) : 'Zone ID',
    supports_id_check: Boolean(g.supports_id_check),
    servers: Array.isArray(g.servers) ? g.servers.map((x) => ({ id: String(x.id), name: String(x.name || x.id) })) : [],
  };
}

// The list of games, and whether buying is open right now
eyadRouter.get('/catalog', requireRole('buyer'), async (req, res, next) => {
  try {
    const s = await getSettings();
    if (!ey.configured() || !(s.usd_ngn > 0)) return res.status(503).json({ error: 'Top-ups are not set up yet' });
    let list;
    try {
      list = await ey.games();
    } catch (e) {
      console.error('eyad games failed:', e.code || e.http || '', e.message);
      return res.status(502).json({ error: 'Could not load the top-up list. Try again shortly.' });
    }
    const q = clean(req.query.search).slice(0, 40).toLowerCase();
    const games = list
      .filter((g) => g && g.id && g.name && (!s.eyad_games.length || s.eyad_games.includes(g.id)) && (!q || String(g.name).toLowerCase().includes(q)))
      .map(gameJson)
      .sort((a, b) => a.name.localeCompare(b.name));
    let buyEnabled = false;
    try {
      const b = await ey.balance();
      buyEnabled = b.balance_usd == null || Number(b.balance_usd) >= 1;
    } catch {
      /* buying stays locked when the balance cannot be read */
    }
    res.json({ provider: 'eyad', buy_enabled: buyEnabled, games });
  } catch (e) { next(e); }
});

// The packs of one game, with Naira prices. A pack is buyable only while the Eyad balance can cover it.
eyadRouter.get('/packages/:game', requireRole('buyer'), async (req, res, next) => {
  try {
    const s = await getSettings();
    if (!ey.configured() || !(s.usd_ngn > 0)) return res.status(503).json({ error: 'Top-ups are not set up yet' });
    const id = clean(req.params.game);
    if (!GAME_OK.test(id)) return res.status(404).json({ error: 'Game not found' });
    let game;
    try {
      game = await findGame(id, s);
    } catch {
      return res.status(502).json({ error: 'Could not load the top-up list. Try again shortly.' });
    }
    if (!game) return res.status(404).json({ error: 'Game not found' });

    let rows;
    try {
      rows = await ey.packages(id);
    } catch (e) {
      console.error('eyad packages failed:', e.code || e.http || '', e.message);
      return res.status(502).json({ error: 'Could not load the packs. Try again shortly.' });
    }
    let bal = 0; // locked unless the balance is known
    try {
      const b = await ey.balance();
      bal = b.balance_usd == null ? null : Number(b.balance_usd);
    } catch {
      /* stays locked */
    }

    const packs = [];
    for (const p of rows) {
      const usd = Number(p && p.price_usd);
      const pid = String((p && (p.group_id || p.id)) || '');
      if (!pid || !(usd > 0) || p.available === false) continue;
      packs.push({
        pack_id: pid,
        name: String(p.name || '').slice(0, 120),
        description: String(p.description || '').slice(0, 200),
        naira: nairaPrice(usd, s.usd_ngn, s.profit_percent),
        buyable: bal === null || bal >= usd * 1.03,
        _usd: usd,
      });
    }
    packs.sort((a, b) => a._usd - b._usd);
    res.json({ game: gameJson(game), packs: packs.map(({ _usd, ...rest }) => rest) });
  } catch (e) { next(e); }
});

// Checks a player ID so the buyer sees the nickname before paying. Free and moves no money.
eyadRouter.post('/validate', requireRole('buyer'), validateLimit, async (req, res, next) => {
  try {
    const s = await getSettings();
    const gameId = clean(req.body.game);
    const uid = clean(req.body.game_user_id);
    const sid = clean(req.body.game_server_id);
    const zid = clean(req.body.zone_id);
    if (!GAME_OK.test(gameId) || !PLAYER_OK.test(uid) || (sid && !FIELD_OK.test(sid)) || (zid && !FIELD_OK.test(zid))) {
      return res.status(400).json({ error: 'Enter a valid player ID' });
    }
    if (ey.used() > 50) return res.status(429).json({ error: 'Busy right now. Try again in a minute.' });
    let game;
    try {
      game = await findGame(gameId, s);
    } catch {
      return res.status(502).json({ error: 'Could not check the player ID right now. Try again.' });
    }
    if (!game) return res.status(404).json({ error: 'Game not found' });
    if (!game.supports_id_check) return res.json({ valid: null, supported: false, player_name: '' });

    try {
      const r = await ey.validate({
        game: gameId,
        user_id: uid,
        ...(game.requires_server && sid ? { server: sid } : {}),
        ...(game.requires_zone && zid ? { zone_id: zid } : {}),
      });
      const valid = r.valid === true;
      res.json({
        valid: r.valid === false ? false : valid ? true : null,
        supported: r.supported !== false,
        player_name: valid ? String(r.name || '').slice(0, 80) : '',
        message: !valid && typeof r.message === 'string' ? r.message.slice(0, 200) : '',
      });
    } catch (e) {
      console.error('eyad validate failed:', e.code || e.http || '', e.message);
      if (e.http === 400 && e.data && typeof e.data.message === 'string') return res.status(400).json({ error: e.data.message.slice(0, 200) });
      res.status(502).json({ error: 'Could not check the player ID right now. Try again.' });
    }
  } catch (e) { next(e); }
});

// Starts a payment for one pack
eyadRouter.post('/checkout', requireRole('buyer'), checkoutLimit, async (req, res, next) => {
  try {
    const s = await getSettings();
    if (!ey.configured() || !secretConfigured() || !(s.usd_ngn > 0)) return res.status(503).json({ error: 'Top-ups are not set up yet' });

    const gameId = clean(req.body.game);
    const packId = clean(req.body.pack_id).slice(0, 120);
    const uid = clean(req.body.game_user_id);
    let sid = clean(req.body.game_server_id);
    let zid = clean(req.body.zone_id);
    if (!GAME_OK.test(gameId) || !packId) return res.status(404).json({ error: 'Pack not found' });
    if (!PLAYER_OK.test(uid)) return res.status(400).json({ error: 'That player ID does not look right' });
    if ((sid && !FIELD_OK.test(sid)) || (zid && !FIELD_OK.test(zid))) return res.status(400).json({ error: 'That server or zone does not look right' });

    let game;
    try {
      game = await findGame(gameId, s);
    } catch {
      return res.status(502).json({ error: 'Could not load this game. Try again.' });
    }
    if (!game) return res.status(404).json({ error: 'This game is not available' });
    if (game.requires_server) {
      if (!sid) return res.status(400).json({ error: 'Choose your server' });
      if (!(Array.isArray(game.servers) ? game.servers : []).some((x) => x.id === sid)) return res.status(400).json({ error: 'Choose a server from the list' });
    } else {
      sid = '';
    }
    if (game.requires_zone) {
      if (!zid) return res.status(400).json({ error: `Enter your ${game.zone_label || 'zone ID'}` });
    } else {
      zid = '';
    }

    const open = await TopupOrder.countDocuments({
      buyer: req.user._id,
      status: 'pending',
      created_at: { $gt: new Date(Date.now() - 30 * 60 * 1000) },
    });
    if (open >= 5) return res.status(429).json({ error: 'You have several unfinished payments. Finish one or wait a few minutes.' });

    // Nobody pays for something we cannot deliver: the Eyad balance must cover this order
    let bal;
    try {
      bal = (await ey.balance()).balance_usd;
    } catch {
      return res.status(503).json({ error: 'Top-ups are temporarily unavailable. Try again later.', code: 'unavailable' });
    }

    let rows;
    try {
      rows = await ey.packages(gameId);
    } catch {
      return res.status(502).json({ error: 'This pack could not be loaded. Try again.' });
    }
    const row = rows.find((p) => p && String(p.group_id || p.id) === packId);
    const usd = Number(row && row.price_usd);
    if (!row || row.available === false || !(usd > 0)) return res.status(409).json({ error: 'This pack is no longer available.' });
    if (bal != null && Number(bal) < usd * 1.03) {
      return res.status(503).json({ error: 'Top-ups are temporarily unavailable. Try again later.', code: 'unavailable' });
    }

    let player = '';
    if (game.supports_id_check) {
      try {
        const v = await ey.validate({
          game: gameId,
          user_id: uid,
          ...(sid ? { server: sid } : {}),
          ...(zid ? { zone_id: zid } : {}),
        });
        if (v.valid === false) return res.status(400).json({ error: (typeof v.message === 'string' && v.message) || 'We could not find that player ID. Check it and try again.' });
        if (v.valid !== true) return res.status(502).json({ error: 'Could not check the player ID right now. Try again.' });
        player = String(v.name || '').slice(0, 80);
      } catch (e) {
        console.error('eyad check failed:', e.code || e.http || '', e.message);
        if (e.http === 400 && e.data && typeof e.data.message === 'string') return res.status(400).json({ error: e.data.message.slice(0, 200) });
        return res.status(502).json({ error: 'Could not check the player ID right now. Try again.' });
      }
    }

    const rate = s.usd_ngn;
    const amount = nairaPrice(usd, rate, s.profit_percent);
    if (req.body.expected_naira != null && Number(req.body.expected_naira) !== amount) {
      return res.status(409).json({ error: `The price changed to ${naira(amount)}. Check it and try again.`, code: 'price_changed', naira: amount });
    }
    // Never pay Eyad more than the buyer paid us (converted at the rate used for this order)
    const cap = Math.floor((amount / rate) * 100) / 100;
    if (!(cap >= usd)) return res.status(409).json({ error: 'This pack is not available right now.' });

    let caps = {};
    try {
      caps = await ey.capabilities();
    } catch {
      /* without it we order by the route id, which always works */
    }
    const orderId = row.group_id && caps.topup_group_orders === true ? String(row.group_id) : String(row.id || '');
    if (!orderId) return res.status(409).json({ error: 'This pack is not available right now.' });

    const kobo = Math.round(amount * 100);
    const reference = 'tp_' + crypto.randomBytes(12).toString('hex');
    const order = await TopupOrder.create({
      reference,
      provider: 'eyad',
      buyer: req.user._id,
      game_id: gameId,
      package_id: orderId,
      product_name: String(game.name || '').slice(0, 120),
      offer_name: String(row.name || '').slice(0, 120),
      game_user_id: uid,
      game_server_id: sid,
      zone_id: zid,
      player_name: player,
      usd_price: usd,
      rate,
      markup_percent: s.profit_percent,
      naira_amount: amount,
      amount_kobo: kobo,
      max_charge_usd: cap,
      eyad_ref: reference,
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
      console.error('Paystack initialize failed (eyad top-up):', err.message);
      res.status(502).json({ error: 'Could not start the payment. Please try again.' });
    }
  } catch (e) { next(e); }
});