// KV-WD-ROUTE v1
import crypto from 'node:crypto';
import { Router } from 'express';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import Purchase from '../models/Purchase.js';
import Withdrawal from '../models/Withdrawal.js';
import User from '../models/User.js';
import { notifyAdmins } from '../lib/notify.js';
import { requireAuth, requireRole, requireAdmin } from '../middleware/auth.js';
import { sweepExpired } from './purchases.js';
import { autoOn, minWithdrawal, round2, sendTransfer, settle, checkWithdrawal } from '../lib/withdrawals.js';

const router = Router();
router.use(requireAuth);

const validId = (id) => mongoose.isValidObjectId(id);
const naira = (n) => '\u20A6' + Number(n || 0).toLocaleString();
// Only orders paid through Paystack count as real money
const REAL = { payment_reference: { $exists: true, $nin: [null, ''] } };
const UNPAID = { $in: ['unpaid', null] };
const release = (wid) =>
  Purchase.updateMany({ withdrawal: wid, payout_status: 'requested' }, { $set: { payout_status: 'unpaid' }, $unset: { withdrawal: 1 } });

const limiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => String(req.user._id),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many withdrawal attempts. Please try again later.' },
});

const shape = (w) => ({
  id: String(w._id),
  amount: w.amount,
  status: w.status,
  order_count: w.order_count,
  created_at: w.created_at,
  paid_at: w.paid_at || null,
  note: w.status === 'failed' ? w.note || '' : '',
});

const shapeAdmin = (w) => ({
  id: String(w._id),
  seller_id: String((w.seller && w.seller._id) || w.seller),
  seller_name: (w.seller && w.seller.full_name) || 'Unknown seller',
  seller_email: (w.seller && w.seller.email) || '',
  suspended: Boolean(w.seller && w.seller.suspended),
  amount: w.amount,
  order_count: w.order_count,
  bank_name: w.bank_name,
  bank_account_number: w.bank_account_number,
  bank_account_name: w.bank_account_name,
  status: w.status,
  mode: w.mode,
  error: w.error || '',
  note: w.note || '',
  reference: w.reference,
  created_at: w.created_at,
  paid_at: w.paid_at || null,
});

/* ------------------------------------------------ SELLER */
router.get('/mine', requireRole('seller'), async (req, res, next) => {
  try {
    await sweepExpired().catch(() => {});
    const rows = await Purchase.find({ ...REAL, seller: req.user._id, escrow_status: 'released' }).select('seller_amount payout_status').lean();
    const sum = (f) => round2(rows.filter(f).reduce((t, p) => t + (Number(p.seller_amount) || 0), 0));
    const u = req.user;
    const hasBank = Boolean(u.bank_name && /^\d{10}$/.test(u.bank_account_number || '') && u.bank_account_name);
    const hist = await Withdrawal.find({ seller: u._id }).sort({ created_at: -1 }).limit(20).lean();
    res.set('Cache-Control', 'no-store');
    res.json({
      available: sum((p) => !p.payout_status || p.payout_status === 'unpaid'),
      pending: sum((p) => p.payout_status === 'requested'),
      paid_out: sum((p) => p.payout_status === 'paid'),
      min: minWithdrawal(),
      auto: autoOn(),
      verified: u.kyc_status === 'verified',
      bank: hasBank ? { bank_name: u.bank_name, last4: u.bank_account_number.slice(-4), account_name: u.bank_account_name } : null,
      withdrawals: hist.map(shape),
    });
  } catch (e) { next(e); }
});

// Withdraw everything that is available. The orders are claimed first, so a double click cannot pay twice.
router.post('/', requireRole('seller'), limiter, async (req, res, next) => {
  let wid = null;
  let created = false;
  try {
    const u = req.user;
    if (u.kyc_status !== 'verified') return res.status(403).json({ error: 'Verify your identity in Settings before you withdraw.' });
    if (!u.bank_name || !/^\d{10}$/.test(u.bank_account_number || '') || !u.bank_account_name) {
      return res.status(400).json({ error: 'Add your bank name, 10 digit account number and account name in Settings first.' });
    }
    await sweepExpired().catch(() => {});

    wid = new mongoose.Types.ObjectId();
    await Purchase.updateMany(
      { ...REAL, seller: u._id, escrow_status: 'released', payout_status: UNPAID },
      { $set: { payout_status: 'requested', withdrawal: wid } }
    );
    const claimed = await Purchase.find({ withdrawal: wid, payout_status: 'requested' }).select('seller_amount').lean();
    if (claimed.length === 0) return res.status(409).json({ error: 'You have no available balance to withdraw.' });

    const amount = round2(claimed.reduce((t, p) => t + (Number(p.seller_amount) || 0), 0));
    const min = Math.max(minWithdrawal(), 1);
    if (amount < min) {
      await release(wid);
      return res.status(400).json({ error: 'The minimum withdrawal is ' + naira(min) + '. You have ' + naira(amount) + ' available.' });
    }

    const w = await Withdrawal.create({
      _id: wid,
      seller: u._id,
      amount,
      order_ids: claimed.map((p) => p._id),
      order_count: claimed.length,
      bank_name: u.bank_name,
      bank_account_number: u.bank_account_number,
      bank_account_name: u.bank_account_name,
      reference: 'kvw_' + crypto.randomBytes(12).toString('hex'),
      status: 'pending',
      mode: autoOn() ? 'auto' : 'manual',
    });
    created = true;

    if (autoOn()) {
      try { await sendTransfer(w._id); } catch (e) { console.error('[withdrawal] automatic send failed:', e.message); }
    } else {
      notifyAdmins({ type: 'order', title: 'New withdrawal request', body: (u.full_name + ': ' + naira(amount)).slice(0, 290), link: '/admin' }).catch(() => {});
    }
    const fresh = await Withdrawal.findById(w._id).lean();
    res.status(201).json({ ok: true, auto: autoOn(), withdrawal: shape(fresh) });
  } catch (e) {
    if (wid && !created) await release(wid).catch(() => {});
    next(e);
  }
});

/* ------------------------------------------------ ADMIN */
router.get('/admin/list', requireAdmin, async (_req, res, next) => {
  try {
    const [open, recent] = await Promise.all([
      Withdrawal.find({ status: { $in: ['pending', 'processing'] } }).sort({ created_at: 1 }).populate('seller', 'full_name email suspended').lean(),
      Withdrawal.find({ status: { $in: ['paid', 'failed'] } }).sort({ updated_at: -1 }).limit(15).populate('seller', 'full_name email suspended').lean(),
    ]);
    res.json({ auto: autoOn(), min: minWithdrawal(), open: open.map(shapeAdmin), recent: recent.map(shapeAdmin) });
  } catch (e) { next(e); }
});

// Admin sent the money by hand
router.post('/admin/:id/paid', requireAdmin, async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ error: 'Withdrawal not found' });
    const w = await Withdrawal.findOne({ _id: req.params.id, status: 'pending' }).select('seller');
    if (!w) return res.status(409).json({ error: 'This withdrawal is not waiting for a manual payment.' });
    const holder = await User.findById(w.seller).select('suspended');
    if (holder && holder.suspended) return res.status(409).json({ error: 'This seller is suspended, so their payout is on hold. Restore the seller first.' });
    const note = typeof req.body.note === 'string' ? req.body.note.trim().slice(0, 120) : '';
    const done = await settle(req.params.id, 'paid', { from: ['pending'], note });
    if (!done) return res.status(409).json({ error: 'This withdrawal is no longer waiting for payment.' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Admin refuses: the money goes back to the seller's wallet
router.post('/admin/:id/reject', requireAdmin, async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ error: 'Withdrawal not found' });
    const reason = typeof req.body.reason === 'string' ? req.body.reason.trim().slice(0, 200) : '';
    if (reason.length < 5) return res.status(400).json({ error: 'Give the seller a short reason' });
    const done = await settle(req.params.id, 'failed', { from: ['pending'], note: reason, error: 'Rejected by admin' });
    if (!done) return res.status(409).json({ error: 'This withdrawal is no longer waiting for payment.' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Admin sends a pending withdrawal through Paystack (after an automatic attempt failed, or to pay by Paystack)
router.post('/admin/:id/send', requireAdmin, async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ error: 'Withdrawal not found' });
    if (!autoOn()) return res.status(400).json({ error: 'Automatic payouts are not switched on. Set AUTO_PAYOUTS=true in server/.env.' });
    const w = await sendTransfer(req.params.id);
    if (!w) return res.status(409).json({ error: 'This withdrawal is not waiting to be sent.' });
    if (w.status === 'pending') return res.status(502).json({ error: w.error || 'Paystack did not accept the transfer.' });
    res.json({ ok: true, status: w.status });
  } catch (e) { next(e); }
});

// Admin asks Paystack what happened to a transfer that is still processing
router.post('/admin/:id/check', requireAdmin, async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ error: 'Withdrawal not found' });
    res.json({ ok: true, status: await checkWithdrawal(req.params.id) });
  } catch (e) {
    if (e && e.status) return res.status(502).json({ error: 'Paystack said: ' + e.message });
    next(e);
  }
});

export default router;