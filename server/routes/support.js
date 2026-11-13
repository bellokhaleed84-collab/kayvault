// KV-SUPPORT v1: contact the admin. Open chat, admin replies, admin closes, closed chat is locked.
import { Router } from 'express';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import SupportTicket from '../models/SupportTicket.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const MAX_MESSAGES = 200;
const validId = (id) => mongoose.isValidObjectId(id);
const clean = (v) => (typeof v === 'string' ? v.trim().slice(0, 1000) : '');
const limiter = (windowMs, max, message) =>
  rateLimit({ windowMs, max, keyGenerator: (req) => String(req.user._id), standardHeaders: true, legacyHeaders: false, message: { error: message } });
const startLimiter = limiter(60 * 60 * 1000, 5, 'Too many new chats. Please try again later.');
const sendLimiter = limiter(60 * 60 * 1000, 60, 'Too many messages. Please try again later.');

const shape = (t) => ({
  id: String(t._id),
  status: t.status,
  closed_at: t.closed_at || null,
  created_at: t.created_at,
  messages: (t.messages || []).map((m) => ({ id: String(m._id), from: m.from, body: m.body, created_at: m.created_at })),
});

/* ---------------- ADMIN (declared first so /admin is not read as an id) ---------------- */
const admin = Router();
admin.use(requireAdmin);

admin.get('/count', async (_req, res, next) => {
  try {
    const [open, unread] = await Promise.all([
      SupportTicket.countDocuments({ status: 'open' }),
      SupportTicket.countDocuments({ status: 'open', admin_unread: { $gt: 0 } }),
    ]);
    res.set('Cache-Control', 'no-store');
    res.json({ open, unread });
  } catch (e) { next(e); }
});

admin.get('/list', async (req, res, next) => {
  try {
    const status = req.query.status === 'closed' ? 'closed' : 'open';
    const rows = await SupportTicket.find({ status })
      .sort({ last_message_at: -1 })
      .limit(100)
      .populate('user', 'full_name email role')
      .lean();
    res.set('Cache-Control', 'no-store');
    res.json(rows.map((t) => {
      const last = (t.messages || [])[(t.messages || []).length - 1];
      return {
        id: String(t._id),
        status: t.status,
        user_name: t.user?.full_name || '-',
        user_email: t.user?.email || '',
        user_role: t.user?.role || '',
        unread: t.admin_unread || 0,
        preview: last ? String(last.body).slice(0, 80) : '',
        last_message_at: t.last_message_at,
      };
    }));
  } catch (e) { next(e); }
});

admin.get('/:id', async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ error: 'Chat not found' });
    const t = await SupportTicket.findByIdAndUpdate(req.params.id, { admin_unread: 0 }, { new: true }).populate('user', 'full_name email role').lean();
    if (!t) return res.status(404).json({ error: 'Chat not found' });
    res.set('Cache-Control', 'no-store');
    res.json({
      ...shape(t),
      user_name: t.user?.full_name || '-',
      user_email: t.user?.email || '',
      user_role: t.user?.role || '',
    });
  } catch (e) { next(e); }
});

admin.post('/:id/messages', sendLimiter, async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ error: 'Chat not found' });
    const body = clean(req.body.body);
    if (body.length < 1) return res.status(400).json({ error: 'Write a message first' });
    const t = await SupportTicket.findOneAndUpdate(
      { _id: req.params.id, status: 'open', ['messages.' + (MAX_MESSAGES - 1)]: { $exists: false } },
      { $push: { messages: { from: 'admin', body } }, $inc: { user_unread: 1 }, $set: { last_message_at: new Date() } },
      { new: true }
    );
    if (!t) return res.status(400).json({ error: 'This chat is closed or full, so messages can no longer be sent' });
    res.status(201).json({ ok: true });
  } catch (e) { next(e); }
});

admin.post('/:id/close', async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ error: 'Chat not found' });
    const t = await SupportTicket.findOneAndUpdate(
      { _id: req.params.id, status: 'open' },
      { $set: { status: 'closed', closed_at: new Date(), admin_unread: 0 } },
      { new: true }
    );
    if (!t) return res.status(400).json({ error: 'This chat is already closed' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.use('/admin', admin);

/* ---------------- USER ---------------- */

// Does the user have a reply they have not read yet?
router.get('/unread', async (req, res, next) => {
  try {
    const n = await SupportTicket.countDocuments({ user: req.user._id, user_unread: { $gt: 0 } });
    res.set('Cache-Control', 'no-store');
    res.json({ unread: n });
  } catch (e) { next(e); }
});

// My latest chat (open or closed). null if I never contacted support.
router.get('/mine', async (req, res, next) => {
  try {
    const t = await SupportTicket.findOneAndUpdate({ user: req.user._id }, { user_unread: 0 }, { new: true, sort: { created_at: -1 } }).lean();
    res.set('Cache-Control', 'no-store');
    res.json({ ticket: t ? shape(t) : null });
  } catch (e) { next(e); }
});

// Start a new chat with a first message
router.post('/', startLimiter, async (req, res, next) => {
  try {
    const body = clean(req.body.body);
    if (body.length < 1) return res.status(400).json({ error: 'Write a message first' });
    try {
      await SupportTicket.create({ user: req.user._id, messages: [{ from: 'user', body }], admin_unread: 1 });
    } catch (e) {
      if (e && e.code === 11000) return res.status(400).json({ error: 'You already have an open chat. Please use it.' });
      throw e;
    }
    res.status(201).json({ ok: true });
  } catch (e) { next(e); }
});

// Send a message in my open chat
router.post('/:id/messages', sendLimiter, async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ error: 'Chat not found' });
    const body = clean(req.body.body);
    if (body.length < 1) return res.status(400).json({ error: 'Write a message first' });
    const t = await SupportTicket.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id, status: 'open', ['messages.' + (MAX_MESSAGES - 1)]: { $exists: false } },
      { $push: { messages: { from: 'user', body } }, $inc: { admin_unread: 1 }, $set: { last_message_at: new Date() } },
      { new: true }
    );
    if (!t) return res.status(400).json({ error: 'This chat is closed, so messages can no longer be sent' });
    res.status(201).json({ ok: true });
  } catch (e) { next(e); }
});

export default router;