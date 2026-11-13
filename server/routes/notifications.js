import { Router } from 'express';
import mongoose from 'mongoose';
import Notification from '../models/Notification.js';
import PushSubscription from '../models/PushSubscription.js'; // KV-PUSH
import { publicKey } from '../lib/push.js'; // KV-PUSH
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const [items, unread] = await Promise.all([
      Notification.find({ user: req.user._id }).sort({ created_at: -1 }).limit(20),
      Notification.countDocuments({ user: req.user._id, read: false }),
    ]);
    res.json({ items, unread });
  } catch (e) { next(e); }
});

// KV-PUSH: the public key the phone needs to subscribe (null if push is not set up on the server)
router.get('/push/key', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ key: publicKey() });
});

router.post('/push/subscribe', async (req, res, next) => {
  try {
    const { endpoint, keys } = req.body || {};
    const p256dh = keys && typeof keys.p256dh === 'string' ? keys.p256dh : '';
    const auth = keys && typeof keys.auth === 'string' ? keys.auth : '';
    if (typeof endpoint !== 'string' || !endpoint.startsWith('https://') || endpoint.length > 1000 || !p256dh || !auth) {
      return res.status(400).json({ error: 'Invalid subscription' });
    }
    const mine = await PushSubscription.countDocuments({ user: req.user._id });
    const already = await PushSubscription.exists({ endpoint, user: req.user._id });
    if (mine >= 10 && !already) return res.status(400).json({ error: 'Too many devices. Turn notifications off on one of them first.' });
    await PushSubscription.findOneAndUpdate({ endpoint }, { user: req.user._id, endpoint, p256dh, auth }, { upsert: true, new: true });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.post('/push/unsubscribe', async (req, res, next) => {
  try {
    const endpoint = req.body && typeof req.body.endpoint === 'string' ? req.body.endpoint : '';
    if (endpoint) await PushSubscription.deleteOne({ endpoint, user: req.user._id });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.post('/read-all', async (req, res, next) => {
  try {
    await Notification.updateMany({ user: req.user._id, read: false }, { read: true });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.post('/:id/read', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Not found' });
    await Notification.updateOne({ _id: req.params.id, user: req.user._id }, { read: true });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;