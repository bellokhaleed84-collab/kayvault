import { Router } from 'express';
import mongoose from 'mongoose';
import Review from '../models/Review.js';
import Purchase from '../models/Purchase.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { notify } from '../lib/notify.js';

const router = Router();
const validId = (id) => mongoose.isValidObjectId(id);

async function summary(sellerId) {
  const [reviews, agg] = await Promise.all([
    Review.find({ seller: sellerId }).sort({ created_at: -1 }).limit(30),
    Review.aggregate([
      { $match: { seller: new mongoose.Types.ObjectId(String(sellerId)) } },
      { $group: { _id: null, avg: { $avg: '$rating' }, n: { $sum: 1 } } },
    ]),
  ]);
  return {
    reviews,
    avg: agg[0] ? Math.round(agg[0].avg * 10) / 10 : null,
    count: agg[0] ? agg[0].n : 0,
  };
}

// Public: reviews for one seller
router.get('/seller/:id', async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ error: 'Seller not found' });
    res.json(await summary(req.params.id));
  } catch (e) { next(e); }
});

router.use(requireAuth);

// Seller: their own reviews
router.get('/mine', requireRole('seller'), async (req, res, next) => {
  try {
    res.json(await summary(req.user._id));
  } catch (e) { next(e); }
});

// Buyer: review the seller once the order is completed (one review per order)
router.post('/', requireRole('buyer'), async (req, res, next) => {
  try {
    const rating = Number(req.body.rating);
    if (!validId(req.body.purchase_id)) return res.status(404).json({ error: 'Order not found' });
    if (!Number.isInteger(rating) || rating < 1 || rating > 5)
      return res.status(400).json({ error: 'Choose a rating from 1 to 5 stars' });
    const comment = typeof req.body.comment === 'string' ? req.body.comment.trim().slice(0, 500) : '';

    const p = await Purchase.findOne({ _id: req.body.purchase_id, buyer: req.user._id });
    if (!p) return res.status(404).json({ error: 'Order not found' });
    if (p.escrow_status !== 'released')
      return res.status(400).json({ error: 'You can review a seller once the order is completed' });

    const parts = req.user.full_name.trim().split(/\s+/);
    const buyer_name = parts[0] + (parts[1] ? ` ${parts[1][0].toUpperCase()}.` : '');

    try {
      const review = await Review.create({
        purchase: p._id,
        listing: p.listing,
        seller: p.seller,
        buyer: req.user._id,
        buyer_name,
        game: p.game,
        rating,
        comment,
      });
      notify(p.seller, { type: 'review', title: 'New review', body: `${buyer_name} left ${rating} ${rating === 1 ? 'star' : 'stars'} on ${p.game}.`, link: '/dashboard/seller' });
      res.status(201).json(review);
    } catch (err) {
      if (err.code === 11000) return res.status(409).json({ error: 'You already reviewed this order' });
      throw err;
    }
  } catch (e) { next(e); }
});

export default router;