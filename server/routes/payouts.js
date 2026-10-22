import { Router } from 'express';
import mongoose from 'mongoose';
import Purchase from '../models/Purchase.js';
import Payment from '../models/Payment.js';
import User from '../models/User.js';
import { notify } from '../lib/notify.js';
import { refundViaPaystack } from '../lib/refunds.js';
import { createRefund, feePercent } from '../lib/paystack.js';
import { requireAuth, requireRole, requireAdmin } from '../middleware/auth.js';
import { sweepExpired } from './purchases.js';

const router = Router();
router.use(requireAuth);

const validId = (id) => mongoose.isValidObjectId(id);
const naira = (n) => '\u20A6' + Number(n || 0).toLocaleString();
const sum = (rows, f) => rows.reduce((t, p) => t + (Number(f(p)) || 0), 0);
const when = (p) => new Date(p.released_at || p.created_at).getTime();

// Only orders paid through Paystack count as real money (older test orders have no reference)
const REAL = { payment_reference: { $exists: true, $nin: [null, ''] } };
// Orders whose refund still needs attention (never sent, or Paystack said no)
const REFUND_TODO = { $in: [null, 'none', 'failed'] };

// Paid-but-undeliverable payments that still need a refund
const refundable = () => ({
  purchase: { $exists: false },
  $or: [
    { status: 'refund_needed' },
    { status: 'error', paid_at: { $exists: true } },
    { status: 'refunding', updated_at: { $lt: new Date(Date.now() - 10 * 60 * 1000) } },
  ],
});

/* ------------------------------------------------ SELLER WALLET */
router.get('/mine', requireRole('seller'), async (req, res, next) => {
  try {
    await sweepExpired().catch(() => {});
    const rows = await Purchase.find({ ...REAL, seller: req.user._id }).lean();
    const released = rows.filter((p) => p.escrow_status === 'released').sort((a, b) => when(b) - when(a));
    const awaiting = released.filter((p) => p.payout_status !== 'paid');
    const paid = released.filter((p) => p.payout_status === 'paid');
    const held = rows.filter((p) => p.escrow_status === 'held' || p.escrow_status === 'refund_requested');
    res.json({
      fee_percent: feePercent(),
      awaiting_payout: sum(awaiting, (p) => p.seller_amount),
      paid_out: sum(paid, (p) => p.seller_amount),
      in_escrow: sum(held, (p) => p.seller_amount),
      fees_paid: sum(released, (p) => p.platform_fee),
      orders: released.slice(0, 100).map((p) => ({
        id: String(p._id),
        game: p.game,
        tier: p.tier,
        price: p.price,
        platform_fee: p.platform_fee || 0,
        seller_amount: p.seller_amount || 0,
        released_at: p.released_at,
        paid: p.payout_status === 'paid',
        payout_paid_at: p.payout_paid_at || null,
      })),
    });
  } catch (e) { next(e); }
});

/* ------------------------------------------------ ADMIN: WHAT TO PAY, WHAT TO REFUND */
router.get('/summary', requireAdmin, async (_req, res, next) => {
  try {
    await sweepExpired().catch(() => {});

    const owedRows = await Purchase.find({
      ...REAL, escrow_status: 'released', payout_status: { $ne: 'paid' },
    }).sort({ released_at: 1 }).lean();

    const bySeller = new Map();
    for (const p of owedRows) {
      const k = String(p.seller);
      const g = bySeller.get(k) || { seller_id: k, total: 0, count: 0, order_ids: [] };
      g.total += Number(p.seller_amount) || 0;
      g.count += 1;
      g.order_ids.push(String(p._id));
      bySeller.set(k, g);
    }
    const users = await User.find({ _id: { $in: [...bySeller.keys()] } })
      .select('full_name email bank_name bank_account_number bank_account_name kyc_status suspended').lean();
    const umap = new Map(users.map((u) => [String(u._id), u]));
    const sellers = [...bySeller.values()].map((g) => {
      const u = umap.get(g.seller_id) || {};
      return {
        ...g,
        name: u.full_name || 'Unknown seller',
        email: u.email || '',
        bank_name: u.bank_name || '',
        bank_account_number: u.bank_account_number || '',
        bank_account_name: u.bank_account_name || '',
        kyc_status: u.kyc_status || 'none',
        suspended: u.suspended === true,
      };
    }).sort((a, b) => b.total - a.total);

    const tot = (match, field) =>
      Purchase.aggregate([
        { $match: { ...REAL, ...match } },
        { $group: { _id: null, sum: { $sum: { $ifNull: [field, 0] } } } },
      ]).then((r) => r[0]?.sum || 0);
    const [paidOut, fees, refunded] = await Promise.all([
      tot({ escrow_status: 'released', payout_status: 'paid' }, '$seller_amount'),
      tot({ escrow_status: 'released' }, '$platform_fee'),
      tot({ escrow_status: 'refunded' }, '$price'),
    ]);

    const retry = await Purchase.find({ ...REAL, escrow_status: 'refunded', refund_status: REFUND_TODO })
      .sort({ updated_at: -1 }).limit(50).populate('buyer', 'full_name email').lean();
    const pays = await Payment.find(refundable())
      .sort({ created_at: 1 }).limit(50).populate('buyer', 'full_name email').lean();

    res.json({
      totals: {
        owed: sum(sellers, (s) => s.total),
        paid_out: paidOut,
        fees,
        refunded,
        fee_percent: feePercent(),
      },
      sellers,
      refunds_to_retry: retry.map((p) => ({
        id: String(p._id),
        game: p.game,
        price: p.price,
        buyer_name: p.buyer?.full_name || '',
        buyer_email: p.buyer?.email || '',
        refund_status: p.refund_status || 'none',
        refund_error: p.refund_error || '',
      })),
      payments_to_refund: pays.map((p) => ({
        reference: p.reference,
        game: p.game,
        amount: p.amount,
        status: p.status,
        buyer_name: p.buyer?.full_name || '',
        buyer_email: p.buyer?.email || '',
        refund_error: p.refund_error || '',
        created_at: p.created_at,
      })),
    });
  } catch (e) { next(e); }
});

/* ------------------------------------------------ ADMIN: MARK A SELLER AS PAID */
// Marks exactly the orders the admin was looking at, so a release that lands
// while the admin is sending the transfer is never marked paid by accident.
router.post('/seller/:id/mark-paid', requireAdmin, async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ error: 'Seller not found' });
    const ids = Array.isArray(req.body.order_ids) ? req.body.order_ids.filter(validId).slice(0, 1000) : [];
    if (ids.length === 0) return res.status(400).json({ error: 'No orders selected' });
    const holder = await User.findById(req.params.id).select('suspended');
    if (holder?.suspended) return res.status(409).json({ error: 'This seller is suspended, so their payout is on hold. Restore the seller first.' });
    const note = typeof req.body.note === 'string' ? req.body.note.trim().slice(0, 120) : '';

    const batch = new mongoose.Types.ObjectId().toString();
    await Purchase.updateMany(
      { ...REAL, _id: { $in: ids }, seller: req.params.id, escrow_status: 'released', payout_status: { $ne: 'paid' } },
      { payout_status: 'paid', payout_paid_at: new Date(), payout_note: note, payout_batch: batch }
    );
    const done = await Purchase.find({ payout_batch: batch }).select('seller_amount').lean();
    if (done.length === 0) return res.status(409).json({ error: 'Nothing to pay for these orders. They may already be marked as paid.' });

    const total = sum(done, (p) => p.seller_amount);
    notify(req.params.id, {
      type: 'order',
      title: 'Payout sent',
      body: `${naira(total)} for ${done.length} ${done.length === 1 ? 'order' : 'orders'} was sent to your bank account.`,
      link: '/dashboard/seller',
    });
    res.json({ count: done.length, total });
  } catch (e) { next(e); }
});

/* ------------------------------------------------ ADMIN: REFUNDS THAT NEED A HAND */
// A refunded order whose Paystack refund failed: try again, or mark it done by hand
router.post('/refund-retry/:id', requireAdmin, async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ error: 'Order not found' });
    const p = await Purchase.findOne({ ...REAL, _id: req.params.id, escrow_status: 'refunded', refund_status: REFUND_TODO });
    if (!p) return res.status(404).json({ error: 'This order is not waiting for a refund' });

    if (req.body.manual === true) {
      p.refund_status = 'manual';
      p.refund_error = '';
      p.refunded_at = new Date();
      await p.save();
      return res.json({ ok: true, refund_status: 'manual' });
    }
    await refundViaPaystack(p);
    if (p.refund_status === 'failed') {
      return res.status(502).json({ error: `Paystack could not refund this order: ${p.refund_error}` });
    }
    res.json({ ok: true, refund_status: p.refund_status });
  } catch (e) { next(e); }
});

// A buyer paid but the account was gone: send the money back
router.post('/payment-refund/:reference', requireAdmin, async (req, res, next) => {
  try {
    const reference = String(req.params.reference || '').slice(0, 80);
    const prev = await Payment.findOneAndUpdate(
      { reference, ...refundable() },
      { status: 'refunding' },
      { new: false }
    );
    if (!prev) return res.status(404).json({ error: 'This payment is not waiting for a refund' });

    try {
      let refundId = '';
      if (req.body.manual !== true) {
        const r = await createRefund({
          transaction: prev.reference,
          amount: prev.amount_kobo,
          customer_note: 'KayVault refund',
          merchant_note: 'Order could not be delivered',
        });
        refundId = String(r?.id || '');
      }
      await Payment.updateOne({ _id: prev._id }, { status: 'refunded', refund_reference: refundId, refunded_at: new Date(), refund_error: '' });
      notify(prev.buyer, {
        type: 'order',
        title: 'Payment refunded',
        body: `${prev.game}: ${naira(prev.amount)} is on its way back to you.`,
        link: '/dashboard/buyer',
      });
      res.json({ ok: true });
    } catch (e) {
      await Payment.updateOne({ _id: prev._id }, { status: prev.status, refund_error: String(e.message || '').slice(0, 200) });
      res.status(502).json({ error: `Paystack could not refund this payment: ${e.message}` });
    }
  } catch (e) { next(e); }
});

export default router;