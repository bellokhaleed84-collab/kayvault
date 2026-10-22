import { Router } from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Listing from '../models/Listing.js';
import Purchase from '../models/Purchase.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { sweepExpired } from './purchases.js';
import AuditLog from '../models/AuditLog.js';
import { decryptJson } from '../lib/crypto.js';

const router = Router();
router.use(requireAuth, requireAdmin);

const validId = (id) => mongoose.isValidObjectId(id);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function total(status) {
  const r = await Purchase.aggregate([
    { $match: { escrow_status: status } },
    { $group: { _id: null, sum: { $sum: '$price' } } },
  ]);
  return r[0]?.sum || 0;
}

// Platform numbers for the overview
router.get('/stats', async (_req, res, next) => {
  try {
    await sweepExpired().catch(() => {});
    const since = new Date();
    since.setMonth(since.getMonth() - 5, 1);
    since.setHours(0, 0, 0, 0);

    const [buyers, sellers, live, pending, sold, orders, held, refReq, released, refunded, refundCount, kycPending, rows] =
      await Promise.all([
        User.countDocuments({ role: 'buyer' }),
        User.countDocuments({ role: 'seller' }),
        Listing.countDocuments({ status: 'live' }),
        Listing.countDocuments({ status: 'pending' }),
        Listing.countDocuments({ status: 'sold' }),
        Purchase.countDocuments(),
        total('held'),
        total('refund_requested'),
        total('released'),
        total('refunded'),
        Purchase.countDocuments({ escrow_status: 'refund_requested' }),
        User.countDocuments({ kyc_status: 'pending' }),
        Purchase.find({ escrow_status: 'released', released_at: { $gte: since } }).select('price released_at').lean(),
      ]);

    const feeAgg = await Purchase.aggregate([
      { $match: { escrow_status: 'released' } },
      { $group: { _id: null, sum: { $sum: { $ifNull: ['$platform_fee', 0] } } } },
    ]);
    const monthly = [];
    const base = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
      monthly.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString('en', { month: 'short' }), value: 0 });
    }
    rows.forEach((p) => {
      const d = new Date(p.released_at);
      const m = monthly.find((x) => x.key === `${d.getFullYear()}-${d.getMonth()}`);
      if (m) m.value += p.price || 0;
    });

    res.json({
      buyers, sellers, live, pending_listings: pending, sold, orders,
      escrow: held + refReq, released, refunded, fees: feeAgg[0]?.sum || 0,
      refund_requests: refundCount, kyc_pending: kycPending, monthly,
    });
  } catch (e) { next(e); }
});

// Refund requests with the buyer's details and reason
router.get('/refunds', async (_req, res, next) => {
  try {
    const rows = await Purchase.find({ escrow_status: 'refund_requested' })
      .sort({ refund_requested_at: 1 }).populate('buyer', 'full_name email').lean();
    res.json(rows.map((p) => ({
      id: String(p._id),
      game: p.game,
      tier: p.tier,
      price: p.price,
      seller_name: p.seller_name,
      buyer_name: p.buyer?.full_name || '',
      buyer_email: p.buyer?.email || '',
      refund_reason: p.refund_reason,
      refund_requested_at: p.refund_requested_at,
      delivered_at: p.delivered_at,
      first_revealed_at: p.first_revealed_at,
      reveal_count: p.reveal_count,
      seller_reply: p.seller_reply || '',
      seller_replied_at: p.seller_replied_at,
      seller_reply_due: p.seller_reply_due,
      created_at: p.created_at,
    })));
  } catch (e) { next(e); }
});

// Latest orders
router.get('/orders', async (_req, res, next) => {
  try {
    await sweepExpired().catch(() => {});
    const rows = await Purchase.find().sort({ created_at: -1 }).limit(50).populate('buyer', 'full_name').lean();
    res.json(rows.map((p) => ({
      id: String(p._id),
      game: p.game,
      tier: p.tier,
      price: p.price,
      escrow_status: p.escrow_status,
      seller_name: p.seller_name,
      buyer_name: p.buyer?.full_name || '',
      created_at: p.created_at,
    })));
  } catch (e) { next(e); }
});

// Users (search + role filter + paging)
router.get('/users', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 20;
    const filter = {};
    if (['buyer', 'seller'].includes(req.query.role)) filter.role = req.query.role;
    if (req.query.q) {
      const rx = new RegExp(esc(String(req.query.q).slice(0, 80)), 'i');
      filter.$or = [{ full_name: rx }, { email: rx }];
    }
    const [items, count] = await Promise.all([
      User.find(filter)
        .select('full_name email role country is_admin suspended kyc_status created_at')
        .sort({ created_at: -1 }).skip((page - 1) * limit).limit(limit),
      User.countDocuments(filter),
    ]);
    const ids = items.map((u) => u._id);
    const group = (key) => [
      { $match: { [key]: { $in: ids } } },
      { $group: { _id: '$' + key, orders: { $sum: 1 }, refunds: { $sum: { $cond: [{ $ifNull: ['$refund_requested_at', false] }, 1, 0] } } } },
    ];
    const [asBuyer, asSeller] = await Promise.all([Purchase.aggregate(group('buyer')), Purchase.aggregate(group('seller'))]);
    const bmap = new Map(asBuyer.map((x) => [String(x._id), x]));
    const smap = new Map(asSeller.map((x) => [String(x._id), x]));
    const withStats = items.map((u) => {
      const stat = (u.role === 'seller' ? smap : bmap).get(String(u._id));
      return { ...u.toJSON(), orders: stat?.orders || 0, refund_requests: stat?.refunds || 0 };
    });
    res.json({ items: withStats, total: count, page, pages: Math.max(1, Math.ceil(count / limit)) });
  } catch (e) { next(e); }
});

// Suspend or restore a user. Admins cannot be suspended.
router.post('/users/:id/suspend', async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ error: 'User not found' });
    if (String(req.user._id) === req.params.id) return res.status(400).json({ error: 'You cannot suspend yourself' });
    const u = await User.findOneAndUpdate(
      { _id: req.params.id, is_admin: { $ne: true } },
      { suspended: req.body.suspended === true },
      { new: true }
    ).select('full_name email role country is_admin suspended kyc_status created_at');
    if (!u) return res.status(404).json({ error: 'User not found (admins cannot be suspended)' });
    await Listing.updateMany({ seller: u._id }, { seller_suspended: u.suspended === true });
    res.json(u);
  } catch (e) { next(e); }
});

// KV-ADMIN-CREDS: admin checks the login details of an order in an open refund case. The check is logged before anything is sent.
router.post('/orders/:id/credentials', async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ error: 'Order not found' });
    const p = await Purchase.findOne({ _id: req.params.id, escrow_status: 'refund_requested' });
    if (!p) return res.status(404).json({ error: 'Order not found, or it is not an open refund case' });
    const l = await Listing.findById(p.listing).select('+credentials_enc');
    if (!l || !l.credentials_enc) return res.status(404).json({ error: 'No delivery details were saved for this order' });
    const data = decryptJson(l.credentials_enc);
    await AuditLog.create({
      admin: req.user._id,
      admin_name: req.user.full_name || req.user.email || '',
      action: 'reveal_credentials',
      purchase: p._id,
      listing: l._id,
      ip: String(req.ip || '').slice(0, 64),
    });
    res.set('Cache-Control', 'no-store');
    res.json(data);
  } catch (e) { next(e); }
});

// Audit log entries for one order
router.get('/orders/:id/audit', async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ error: 'Order not found' });
    const rows = await AuditLog.find({ purchase: req.params.id }).sort({ created_at: -1 }).limit(50).lean();
    res.json(rows.map((r) => ({ id: String(r._id), admin_name: r.admin_name, action: r.action, created_at: r.created_at })));
  } catch (e) { next(e); }
});

export default router;