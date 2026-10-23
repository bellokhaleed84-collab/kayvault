import { Router } from 'express';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import Listing from '../models/Listing.js';
import Purchase from '../models/Purchase.js';
import Payment from '../models/Payment.js';
import User from '../models/User.js'; // KV-P17E-IMP
import { notify, notifyAdmins } from '../lib/notify.js';
import { initTransaction, verifyTransaction, validSignature, feePercent, secretConfigured } from '../lib/paystack.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
const RESERVE_MS = 30 * 60 * 1000;    // listing is held for the paying buyer
const WINDOW_MS = 24 * 60 * 60 * 1000; // buyer confirm window (same as before)
const validId = (id) => mongoose.isValidObjectId(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const naira = (n) => '\u20A6' + Number(n || 0).toLocaleString();

async function releaseReservation(pay) {
  await Listing.updateOne({ _id: pay.listing, reserved_by: pay.buyer }, { reserved_by: null, reserved_until: null }).catch(() => {});
}

async function needsRefund(pay, why) {
  await Payment.updateOne({ _id: pay._id }, { status: 'refund_needed' });
  notifyAdmins({
    type: 'order',
    title: 'Payment needs a manual refund',
    body: `${pay.game} ${naira(pay.amount)} ref ${pay.reference}: ${why}`.slice(0, 290),
    link: '/admin',
  }).catch(() => {});
  notify(pay.buyer, {
    type: 'order',
    title: 'Payment received, order not available',
    body: `${pay.game} could not be delivered. Your payment will be refunded.`,
    link: '/dashboard/buyer',
  });
  return { ok: false, status: 409, code: 'refund_needed', error: 'This account is no longer available. Your payment will be refunded.' };
}

// Turns a verified Paystack payment into an order. Safe to call many times for the same reference.
async function fulfill(reference) {
  const pay = await Payment.findOne({ reference });
  if (!pay) return { ok: false, status: 404, error: 'Payment not found' };
  if (pay.purchase) return { ok: true, purchase_id: String(pay.purchase) };
  if (pay.status === 'refund_needed' || pay.status === 'refunding' || pay.status === 'refunded') {
    return { ok: false, status: 409, code: 'refund_needed', error: 'This account is no longer available. Your payment will be refunded.' };
  }

  let tx;
  try {
    tx = await verifyTransaction(reference);
  } catch {
    return { ok: false, status: 502, error: 'Could not confirm the payment with Paystack yet. Try again in a moment.' };
  }

  if (tx.status !== 'success') {
    if (['failed', 'abandoned', 'reversed'].includes(tx.status)) {
      await Payment.updateOne({ _id: pay._id, status: { $in: ['pending', 'failed'] } }, { status: 'failed' });
      await releaseReservation(pay);
      return { ok: false, status: 402, code: 'not_paid', error: 'The payment was not completed.' };
    }
    return { ok: true, waiting: true };
  }

  if (tx.amount !== pay.amount_kobo || tx.currency !== 'NGN') {
    await Payment.updateOne({ _id: pay._id }, { status: 'error' });
    notifyAdmins({ type: 'order', title: 'Payment amount mismatch', body: `ref ${reference}: expected ${pay.amount_kobo} got ${tx.amount} ${tx.currency}`, link: '/admin' }).catch(() => {});
    return { ok: false, status: 409, error: 'The payment amount did not match. Our team has been notified.' };
  }

  // Only one caller may turn this payment into an order
  const staleBefore = new Date(Date.now() - 2 * 60 * 1000);
  const claimed = await Payment.findOneAndUpdate(
    {
      reference,
      $or: [
        { status: { $in: ['pending', 'error', 'failed'] } },
        { status: 'processing', updated_at: { $lt: staleBefore } },
      ],
    },
    { status: 'processing', paystack_id: String(tx.id || ''), paid_at: new Date() },
    { new: true }
  );
  if (!claimed) {
    for (let i = 0; i < 6; i++) {
      await sleep(1000);
      const again = await Payment.findOne({ reference });
      if (again?.purchase) return { ok: true, purchase_id: String(again.purchase) };
      if (again?.status === 'refund_needed') return { ok: false, status: 409, code: 'refund_needed', error: 'This account is no longer available. Your payment will be refunded.' };
    }
    return { ok: true, waiting: true };
  }

  try {
    const existing = await Purchase.findOne({ payment_reference: reference });
    if (existing) {
      await Payment.updateOne({ _id: pay._id }, { status: 'paid', purchase: existing._id });
      return { ok: true, purchase_id: existing.id };
    }

    const now = new Date();
    const listing = await Listing.findOneAndUpdate(
      {
        _id: pay.listing,
        status: 'live',
        seller: { $ne: pay.buyer },
        $or: [{ reserved_by: pay.buyer }, { reserved_until: null }, { reserved_until: { $lte: now } }],
      },
      { status: 'sold', reserved_by: null, reserved_until: null },
      { new: true }
    ).select('+credentials_enc');

    if (!listing) return await needsRefund(pay, 'listing no longer available');
    if (!listing.credentials_enc) {
      await Listing.updateOne({ _id: listing._id }, { status: 'live' });
      return await needsRefund(pay, 'listing has no delivery details');
    }

    let purchase;
    try {
      purchase = await Purchase.create({
        listing: listing._id,
        buyer: pay.buyer,
        seller: listing.seller,
        seller_name: listing.seller_name,
        game: listing.game,
        tier: listing.tier,
        price: pay.amount,
        platform_fee: pay.fee,
        seller_amount: pay.seller_amount,
        payment_reference: reference,
        has_image: (listing.images || []).length > 0,
        escrow_status: 'held',
        delivered_at: now,
        confirm_deadline: new Date(now.getTime() + WINDOW_MS),
      });
    } catch (err) {
      await Listing.updateOne({ _id: listing._id }, { status: 'live' }); // roll back
      throw err;
    }

    await Payment.updateOne({ _id: pay._id }, { status: 'paid', purchase: purchase._id });
    notify(listing.seller, { type: 'order', title: 'New order', body: `${listing.game} was bought for ${naira(pay.amount)}. Payment is held in escrow.`, link: '/dashboard/seller' });
    notify(pay.buyer, { type: 'order', title: 'Payment received', body: `${listing.game}: your login details are ready.`, link: `/orders/${purchase.id}` });
    return { ok: true, purchase_id: purchase.id };
  } catch (e) {
    console.error('fulfill failed for', reference, e);
    await Payment.updateOne({ _id: pay._id }, { status: 'error' }).catch(() => {});
    notifyAdmins({ type: 'order', title: 'Payment needs attention', body: `ref ${reference} was paid but the order could not be created.`, link: '/admin' }).catch(() => {});
    return { ok: false, status: 500, error: 'We received your payment but could not finish the order. Our team has been notified.' };
  }
}

// KV-PAY-SWEEP: finds payments Paystack confirmed but the webhook and the buyer's page both missed
export async function sweepPayments() {
  const now = Date.now();
  const rows = await Payment.find({
    purchase: { $exists: false },
    status: { $in: ['pending', 'processing'] },
    created_at: { $lt: new Date(now - 3 * 60 * 1000), $gt: new Date(now - 6 * 60 * 60 * 1000) },
  }).select('reference created_at').limit(25).lean();

  let done = 0;
  for (const p of rows) {
    try {
      const young = now - new Date(p.created_at).getTime() < 35 * 60 * 1000;
      // A buyer may still be typing their card, so a young payment is only picked up once Paystack says it succeeded
      if (young) {
        const tx = await verifyTransaction(p.reference);
        if (tx.status !== 'success') continue;
      }
      const r = await fulfill(p.reference);
      if (r.ok && r.purchase_id) done++;
    } catch (e) {
      console.error('payment sweep skipped', p.reference, e.message);
    }
  }
  return done;
}

/* ------------------------------------------------ WEBHOOK (Paystack calls this; no login) */
router.post('/webhook', async (req, res) => {
  try {
    if (!validSignature(req.rawBody, req.headers['x-paystack-signature'])) return res.status(401).end();
    const ev = req.body;
    if (ev?.event === 'charge.success' && ev.data?.reference) {
      const r = await fulfill(String(ev.data.reference));
      if (r.status === 500 || r.status === 502) return res.status(500).end(); // Paystack will retry
    }
    res.sendStatus(200);
  } catch (e) {
    console.error('webhook error:', e.message);
    res.status(500).end();
  }
});

router.use(requireAuth);

/* ------------------------------------------------ START A PAYMENT */
router.post('/initialize', requireRole('buyer'), async (req, res, next) => {
  try {
    if (!validId(req.body.listing_id)) return res.status(404).json({ error: 'Listing not found' });
    if (!secretConfigured()) return res.status(503).json({ error: 'Payments are not set up yet' });
    // One active reservation per buyer: starting a new checkout frees any older one
    await Listing.updateMany({ reserved_by: req.user._id, _id: { $ne: req.body.listing_id } }, { reserved_by: null, reserved_until: null });

    const now = new Date();
    const listing = await Listing.findOneAndUpdate(
      {
        _id: req.body.listing_id,
        status: 'live',
        seller: { $ne: req.user._id },
        seller_suspended: { $ne: true },
        $or: [{ reserved_until: null }, { reserved_until: { $lte: now } }, { reserved_by: req.user._id }],
      },
      { reserved_by: req.user._id, reserved_until: new Date(now.getTime() + RESERVE_MS) },
      { new: true }
    ).select('+credentials_enc');
    if (!listing) {
      return res.status(409).json({ error: 'This account is no longer available, or another buyer is paying for it right now. Try again in a few minutes.' });
    }

    const release = () =>
      Listing.updateOne({ _id: listing._id, reserved_by: req.user._id }, { reserved_by: null, reserved_until: null }).catch(() => {});

    if (!listing.credentials_enc) {
      await release();
      return res.status(409).json({ error: 'The seller has not added delivery details for this account yet' });
    }

    const sellerKyc = await User.findById(listing.seller).select('kyc_status'); // KV-P17E-PAY
    if (!sellerKyc || sellerKyc.kyc_status !== 'verified') {
      await release();
      return res.status(409).json({ error: 'This seller is not verified, so this account cannot be bought right now.' });
    }
    const amount_kobo = Math.round(listing.price * 100);
    const feeKobo = Math.round((amount_kobo * feePercent()) / 100);
    const reference = 'kv_' + crypto.randomBytes(12).toString('hex');

    const pay = await Payment.create({
      reference,
      listing: listing._id,
      buyer: req.user._id,
      seller: listing.seller,
      game: listing.game,
      amount: amount_kobo / 100,
      amount_kobo,
      fee: feeKobo / 100,
      seller_amount: (amount_kobo - feeKobo) / 100,
      status: 'pending',
    });

    const origin = (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',')[0];
    try {
      const tx = await initTransaction({
        email: req.user.email,
        amount: amount_kobo,
        currency: 'NGN',
        reference,
        callback_url: `${origin}/payment/callback`,
        metadata: { listing_id: String(listing._id), buyer_id: String(req.user._id) },
      });
      res.json({ authorization_url: tx.authorization_url, reference });
    } catch (err) {
      await Payment.updateOne({ _id: pay._id }, { status: 'failed' });
      await release();
      console.error('Paystack initialize failed:', err.message);
      return res.status(502).json({ error: 'Could not start the payment. Please try again.' });
    }
  } catch (e) { next(e); }
});

/* ------------------------------------------------ BUYER COMES BACK FROM PAYSTACK */
router.post('/verify', requireRole('buyer'), async (req, res, next) => {
  try {
    const reference = typeof req.body.reference === 'string' ? req.body.reference.slice(0, 80) : '';
    const pay = reference && (await Payment.findOne({ reference, buyer: req.user._id }));
    if (!pay) return res.status(404).json({ error: 'Payment not found' });

    const r = await fulfill(reference);
    if (r.waiting) return res.status(202).json({ code: 'waiting' });
    if (!r.ok) return res.status(r.status || 400).json({ error: r.error, code: r.code });
    res.json({ purchase_id: r.purchase_id });
  } catch (e) { next(e); }
});

export default router;