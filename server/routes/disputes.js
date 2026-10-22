import { Router } from 'express';
import mongoose from 'mongoose';
import Purchase from '../models/Purchase.js';
import { notifyAdmins } from '../lib/notify.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// Seller: answer a refund request. One reply only, so it cannot be rewritten after the admin has read it.
router.post('/:id/reply', requireRole('seller'), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Refund request not found' });
    const note = typeof req.body.note === 'string' ? req.body.note.trim().slice(0, 500) : '';
    if (note.length < 5) return res.status(400).json({ error: 'Tell us your side of the story (at least a few words)' });

    const p = await Purchase.findOneAndUpdate(
      {
        _id: req.params.id,
        seller: req.user._id,
        escrow_status: 'refund_requested',
        $or: [{ seller_reply: '' }, { seller_reply: { $exists: false } }],
      },
      { seller_reply: note, seller_replied_at: new Date() },
      { new: true }
    );
    if (!p) return res.status(404).json({ error: 'Refund request not found, or you already replied' });

    notifyAdmins({ type: 'order', title: 'Seller replied to a refund request', body: `${p.game}: ${note.slice(0, 120)}`, link: '/admin' }).catch(() => {});
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;