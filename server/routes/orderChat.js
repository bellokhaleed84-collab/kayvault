// KV-ORDERCHAT v1: private chat between the buyer and the seller of one order
import { Router } from 'express';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import Purchase from '../models/Purchase.js';
import OrderMessage from '../models/OrderMessage.js';
import { notify } from '../lib/notify.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const validId = (id) => mongoose.isValidObjectId(id);
const CLOSE_AFTER_MS = 3 * 24 * 60 * 60 * 1000; // chat stays open 3 days after the payment is released
const sendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 60,
  keyGenerator: (req) => String(req.user._id),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many messages. Please try again later.' },
});

// Who is this person on this order? Decided by ownership, never by what the client says.
function roleOf(req, p) {
  if (String(p.buyer) === String(req.user._id)) return 'buyer';
  if (String(p.seller) === String(req.user._id)) return 'seller';
  if (req.user.is_admin) return 'admin';
  return null;
}

function isOpen(p) {
  if (p.escrow_status === 'held' || p.escrow_status === 'refund_requested') return true;
  if (p.escrow_status === 'released') return Boolean(p.released_at) && Date.now() - new Date(p.released_at).getTime() < CLOSE_AFTER_MS;
  return false;
}

// How many unread messages the person has on each of their orders
router.get('/unread', async (req, res, next) => {
  try {
    const mine = await Purchase.find({ $or: [{ buyer: req.user._id }, { seller: req.user._id }] }).select('_id').lean();
    if (!mine.length) return res.json({ counts: {}, total: 0 });
    const rows = await OrderMessage.aggregate([
      { $match: { purchase: { $in: mine.map((m) => m._id) }, read: false, sender: { $ne: req.user._id } } },
      { $group: { _id: '$purchase', n: { $sum: 1 } } },
    ]);
    const counts = {};
    let total = 0;
    for (const r of rows) {
      counts[String(r._id)] = r.n;
      total += r.n;
    }
    res.set('Cache-Control', 'no-store');
    res.json({ counts, total });
  } catch (e) { next(e); }
});

router.get('/:id/messages', async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ error: 'Order not found' });
    const p = await Purchase.findById(req.params.id).select('buyer seller game escrow_status released_at');
    if (!p) return res.status(404).json({ error: 'Order not found' });
    const role = roleOf(req, p);
    if (!role) return res.status(404).json({ error: 'Order not found' });

    const rows = await OrderMessage.find({ purchase: p._id }).sort({ created_at: 1 }).limit(200).lean();
    if (role !== 'admin') {
      OrderMessage.updateMany({ purchase: p._id, sender: { $ne: req.user._id }, read: false }, { read: true }).catch(() => {});
    }
    res.set('Cache-Control', 'no-store');
    res.json({
      role,
      open: role !== 'admin' && isOpen(p),
      messages: rows.map((m) => ({
        id: String(m._id),
        body: m.body,
        from: m.from,
        mine: String(m.sender) === String(req.user._id),
        created_at: m.created_at,
      })),
    });
  } catch (e) { next(e); }
});

router.post('/:id/messages', sendLimiter, async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ error: 'Order not found' });
    const p = await Purchase.findById(req.params.id).select('buyer seller game escrow_status released_at');
    if (!p) return res.status(404).json({ error: 'Order not found' });
    const role = roleOf(req, p);
    if (role !== 'buyer' && role !== 'seller') return res.status(404).json({ error: 'Order not found' });
    if (!isOpen(p)) return res.status(400).json({ error: 'This chat is closed, so messages can no longer be sent' });

    const text = typeof req.body.body === 'string' ? req.body.body.trim().slice(0, 1000) : '';
    if (text.length < 1) return res.status(400).json({ error: 'Write a message first' });

    // Only ping the other person when they are not already waiting on an unread message from this sender
    const alreadyPinged = await OrderMessage.exists({ purchase: p._id, sender: req.user._id, read: false });
    await OrderMessage.create({ purchase: p._id, sender: req.user._id, from: role, body: text });
    if (!alreadyPinged) {
      // The message text is never put in a notification (it could be a login code)
      notify(role === 'buyer' ? p.seller : p.buyer, {
        type: 'order',
        title: 'New message about ' + p.game,
        body: 'Open the order chat to read it.',
        link: role === 'buyer' ? '/dashboard/seller' : '/orders/' + String(p._id),
      });
    }
    res.status(201).json({ ok: true });
  } catch (e) { next(e); }
});

export default router;