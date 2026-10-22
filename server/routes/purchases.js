import { Router } from 'express';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import Listing from '../models/Listing.js';
import Purchase from '../models/Purchase.js';
import Review from '../models/Review.js';
import { notify, notifyAdmins } from '../lib/notify.js';
import { requireAuth, requireRole, requireAdmin } from '../middleware/auth.js';
import { decryptJson } from '../lib/crypto.js';
import RefundProof from '../models/RefundProof.js';
import { refundViaPaystack } from '../lib/refunds.js';

const router = Router();
// Login details can be opened a reasonable number of times per hour, then the buyer has to wait
const credsLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 40,
  keyGenerator: (req) => String(req.user._id),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests for login details. Please try again later.' },
});
const WINDOW_MS = 24 * 60 * 60 * 1000; // buyer confirm window
const validId = (id) => mongoose.isValidObjectId(id);

// Orders the buyer never answered within 24 hours are released to the seller.
export async function sweepExpired() {
  const now = new Date();
  const r = await Purchase.updateMany(
    { escrow_status: 'held', confirm_deadline: { $lte: now } },
    { escrow_status: 'released', released_at: now, auto_released: true }
  );
  return r.modifiedCount || 0;
}

router.use(requireAuth);

// Buy: atomic claim so two buyers can't get the same listing
router.post('/', requireRole('buyer'), async (req, res, next) => {
  try {
    if (process.env.ALLOW_FREE_PURCHASE !== 'true') return res.status(402).json({ error: 'Please pay with Paystack to buy this account' });
    if (!validId(req.body.listing_id)) return res.status(404).json({ error: 'Listing not found' });

    const listing = await Listing.findOneAndUpdate(
      { _id: req.body.listing_id, status: 'live', seller: { $ne: req.user._id } },
      { status: 'sold' },
      { new: true }
    ).select('+credentials_enc');
    if (!listing) return res.status(409).json({ error: 'Listing is no longer available' });

    if (!listing.credentials_enc) {
      await Listing.updateOne({ _id: listing._id }, { status: 'live' }); // roll back
      return res.status(409).json({ error: 'The seller has not added delivery details for this account yet' });
    }

    try {
      const now = new Date();
      const purchase = await Purchase.create({
        listing: listing._id,
        buyer: req.user._id,
        seller: listing.seller,
        seller_name: listing.seller_name,
        game: listing.game,
        tier: listing.tier,
        price: listing.price,
        has_image: (listing.images || []).length > 0,
        escrow_status: 'held',
        delivered_at: now,
        confirm_deadline: new Date(now.getTime() + WINDOW_MS),
      });
      notify(listing.seller, { type: 'order', title: 'New order', body: `${listing.game} was bought for \u20A6${Number(listing.price).toLocaleString()}. Payment is held in escrow.`, link: '/dashboard/seller' });
      res.status(201).json(purchase);
    } catch (err) {
      await Listing.updateOne({ _id: listing._id }, { status: 'live' }); // roll back
      throw err;
    }
  } catch (e) { next(e); }
});

router.get('/sales', requireRole('seller'), async (req, res, next) => {
  try {
    await sweepExpired().catch(() => {});
    res.json(await Purchase.find({ seller: req.user._id }).select('-buyer').sort({ created_at: -1 }));
  } catch (e) { next(e); }
});

router.get('/mine', requireRole('buyer'), async (req, res, next) => {
  try {
    await sweepExpired().catch(() => {});
    res.json(await Purchase.find({ buyer: req.user._id }).sort({ created_at: -1 }));
  } catch (e) { next(e); }
});

// Admin: view refund requests (declared before /:id routes)
router.get('/refund-requests', requireAdmin, async (_req, res, next) => {
  try {
    res.json(await Purchase.find({ escrow_status: 'refund_requested' }).sort({ created_at: 1 }));
  } catch (e) { next(e); }
});

// Buyer confirms the account works -> release to seller
router.post('/:id/confirm', requireRole('buyer'), async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ error: 'Purchase not found' });
    const p = await Purchase.findOneAndUpdate(
      { _id: req.params.id, buyer: req.user._id, escrow_status: 'held' },
      { escrow_status: 'released', released_at: new Date() },
      { new: true }
    );
    if (!p) return res.status(404).json({ error: 'Purchase not found or already settled' });
    notify(p.seller, { type: 'order', title: 'Payment released', body: `The buyer confirmed ${p.game}. Your earnings are ready.`, link: '/dashboard/seller' });
    res.json(p);
  } catch (e) { next(e); }
});

// Buyer requests refund (admin decides). Only inside the 24 hour window.
router.post('/:id/refund-request', requireRole('buyer'), async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ error: 'Purchase not found' });
    const reason = typeof req.body.reason === 'string' ? req.body.reason.trim().slice(0, 500) : '';
    if (reason.length < 5) return res.status(400).json({ error: 'Tell us what went wrong so we can review it' });
    const proofCount = await RefundProof.countDocuments({ purchase: req.params.id, buyer: req.user._id });
    if (proofCount < 1) return res.status(400).json({ error: 'Add a screenshot or screen recording as proof before sending your refund request' });

    const now = new Date();
    const p = await Purchase.findOneAndUpdate(
      {
        _id: req.params.id,
        buyer: req.user._id,
        escrow_status: 'held',
        $or: [
          { confirm_deadline: { $exists: false } },
          { confirm_deadline: null },
          { confirm_deadline: { $gt: now } },
        ],
      },
      { escrow_status: 'refund_requested', refund_reason: reason, refund_requested_at: now, seller_reply_due: new Date(now.getTime() + 12 * 60 * 60 * 1000) },
      { new: true }
    );
    if (!p) return res.status(404).json({ error: 'Purchase not found, already settled, or the 24 hour window has closed' });
    notify(p.seller, { type: 'order', title: 'Refund requested', body: `The buyer asked for a refund on ${p.game}. Reply with your side within 12 hours so our team can review it.`, link: '/dashboard/seller' });
    notifyAdmins({ type: 'order', title: 'Refund request to review', body: `${p.game}: ${reason.slice(0, 120)}`, link: '/admin' }).catch(() => {});
    res.json(p);
  } catch (e) { next(e); }
});

router.post('/:id/resolve', requireAdmin, async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ error: 'Refund request not found' });
    const action = req.body.action;
    const next_status = action === 'refund' ? 'refunded' : action === 'release' ? 'released' : null;
    if (!next_status) return res.status(400).json({ error: "action must be 'refund' or 'release'" });
    const update = { escrow_status: next_status };
    if (next_status === 'released') update.released_at = new Date();
    const p = await Purchase.findOneAndUpdate(
      { _id: req.params.id, escrow_status: 'refund_requested' },
      update,
      { new: true }
    );
    if (!p) return res.status(404).json({ error: 'Refund request not found' });
    if (next_status === 'refunded') await refundViaPaystack(p);
    notify(p.buyer, { type: 'order', title: next_status === 'refunded' ? 'Refund approved' : 'Refund request declined', body: next_status === 'refunded' ? `${p.game} was refunded to you.` : `${p.game}: payment was released to the seller.`, link: `/orders/${p.id}` });
    const keepUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    RefundProof.updateMany({ purchase: p._id, cloud_id: { $exists: false } }, { expires_at: keepUntil }).catch(() => {});
    RefundProof.updateMany({ purchase: p._id, cloud_id: { $exists: true } }, { delete_after: keepUntil }).catch(() => {});
    notify(p.seller, { type: 'order', title: next_status === 'released' ? 'Payment released' : 'Order refunded', body: p.game, link: '/dashboard/seller' });
    res.json(p);
  } catch (e) { next(e); }
});

// Buyer: login details for an order they own. Never cached, never listed anywhere else.
router.get('/:id/credentials', requireRole('buyer'), credsLimiter, async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ error: 'Purchase not found' });
    const p = await Purchase.findOne({ _id: req.params.id, buyer: req.user._id });
    if (!p) return res.status(404).json({ error: 'Purchase not found' });
    if (p.escrow_status === 'refunded')
      return res.status(403).json({ error: 'This order was refunded, so the login details are no longer available' });

    const l = await Listing.findById(p.listing).select('+credentials_enc');
    if (!l?.credentials_enc) return res.status(404).json({ error: 'No delivery details were saved for this order' });

    Purchase.updateOne({ _id: p._id }, { $inc: { reveal_count: 1 }, last_revealed_at: new Date() }).catch(() => {});
    Purchase.updateOne({ _id: p._id, first_revealed_at: { $exists: false } }, { first_revealed_at: new Date() }).catch(() => {});
    res.set('Cache-Control', 'no-store');
    res.json(decryptJson(l.credentials_enc));
  } catch (e) { next(e); }
});

// Buyer: one order (used by the Account Delivery screen)
router.get('/:id', requireRole('buyer'), async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ error: 'Purchase not found' });
    await sweepExpired().catch(() => {});
    const p = await Purchase.findOne({ _id: req.params.id, buyer: req.user._id });
    if (!p) return res.status(404).json({ error: 'Purchase not found' });
    const l = await Listing.findById(p.listing).select('level platform account_type features');
    const review = await Review.findOne({ purchase: p._id });
    res.json({
      purchase: p,
      review: review ? { rating: review.rating, comment: review.comment } : null,
      listing: l ? { level: l.level, platform: l.platform, account_type: l.account_type, features: l.features } : null,
    });
  } catch (e) { next(e); }
});

export default router;