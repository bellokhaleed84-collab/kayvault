// KV-CASES v1
import { Router } from 'express';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import Purchase from '../models/Purchase.js';
import CaseMessage from '../models/CaseMessage.js';
import { notify, notifyAdmins } from '../lib/notify.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const validId = (id) => mongoose.isValidObjectId(id);
const sendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 60,
  keyGenerator: (req) => String(req.user._id),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many messages. Please try again later.' },
});

// Which private thread is this person allowed to use? Decided by ownership of the order, never by what the client says.
function threadFor(req, p) {
  if (req.user.is_admin) {
    const w = (req.query && req.query.with) || (req.body && req.body.with);
    return w === 'buyer' || w === 'seller' ? w : null;
  }
  if (String(p.buyer) === String(req.user._id)) return 'buyer';
  if (String(p.seller) === String(req.user._id)) return 'seller';
  return null;
}

router.get('/:id/messages', async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ error: 'Order not found' });
    const p = await Purchase.findById(req.params.id).select('buyer seller escrow_status');
    if (!p) return res.status(404).json({ error: 'Order not found' });
    const thread = threadFor(req, p);
    if (!thread) return res.status(req.user.is_admin ? 400 : 404).json({ error: req.user.is_admin ? 'Choose buyer or seller' : 'Order not found' });

    const rows = await CaseMessage.find({ purchase: p._id, thread }).sort({ created_at: 1 }).limit(200).lean();
    const admin = req.user.is_admin === true;
    res.set('Cache-Control', 'no-store');
    res.json({
      open: p.escrow_status === 'refund_requested',
      has_support: rows.some((m) => m.from_admin),
      messages: rows.map((m) => ({
        id: String(m._id),
        body: m.body,
        flag: m.flag === true,
        from_admin: m.from_admin === true,
        mine: admin ? m.from_admin === true : m.from_admin !== true,
        created_at: m.created_at,
      })),
    });
  } catch (e) { next(e); }
});

router.post('/:id/messages', sendLimiter, async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ error: 'Order not found' });
    const p = await Purchase.findById(req.params.id).select('buyer seller game escrow_status');
    if (!p) return res.status(404).json({ error: 'Order not found' });
    const thread = threadFor(req, p);
    if (!thread) return res.status(req.user.is_admin ? 400 : 404).json({ error: req.user.is_admin ? 'Choose buyer or seller' : 'Order not found' });
    if (p.escrow_status !== 'refund_requested') return res.status(400).json({ error: 'This case is closed, so messages can no longer be sent' });

    const text = typeof req.body.body === 'string' ? req.body.body.trim().slice(0, 1000) : '';
    if (text.length < 1) return res.status(400).json({ error: 'Write a message first' });

    if (req.user.is_admin) {
      const flag = req.body.flag === true;
      await CaseMessage.create({ purchase: p._id, thread, from_admin: true, sender: req.user._id, body: text, flag });
      const target = thread === 'buyer' ? p.buyer : p.seller;
      const link = thread === 'buyer' ? '/orders/' + String(p._id) : '/dashboard/seller';
      notify(target, {
        type: 'order',
        title: flag ? 'KayVault support needs information from you' : 'New message from KayVault support',
        body: ((flag ? 'Please reply as soon as you can. ' : '') + p.game + ': ' + text).slice(0, 290),
        link,
      });
    } else {
      // People can only answer: support has to write first
      if (!(await CaseMessage.exists({ purchase: p._id, thread, from_admin: true }))) {
        return res.status(403).json({ error: 'Support has not asked you anything on this order yet' });
      }
      await CaseMessage.create({ purchase: p._id, thread, from_admin: false, sender: req.user._id, body: text });
      notifyAdmins({ type: 'order', title: 'Reply in a refund case', body: (p.game + ': ' + text).slice(0, 140), link: '/admin' }).catch(() => {});
    }
    res.status(201).json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
