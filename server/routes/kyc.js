import { Router } from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import KycSubmission from '../models/KycSubmission.js';
import { kycCloudConfigured, storeImages, fetchPrivate, destroyPrivate, scheduleDelete } from '../lib/kycStore.js';
import { notify, notifyAdmins } from '../lib/notify.js';
import { requireAuth, requireRole, requireAdmin } from '../middleware/auth.js';

const router = Router();
const ID_TYPES = ['nin', 'drivers_licence', 'passport'];
const validId = (id) => mongoose.isValidObjectId(id);
const badRequest = (msg) => Object.assign(new Error(msg), { status: 400 });

function parseImage(s, label) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(s || ''));
  if (!m) throw badRequest(`${label} must be a JPEG, PNG or WebP image`);
  const data = Buffer.from(m[2], 'base64');
  if (data.length > 600 * 1024) throw badRequest(`${label} must be under 600 KB`);
  return { mime: m[1], data };
}

const toDataUrl = (img) => `data:${img.mime};base64,${img.data.toString('base64')}`;

router.use(requireAuth);

// Seller: my verification status
router.get('/mine', requireRole('seller'), (req, res) => {
  res.json({
    status: req.user.kyc_status || 'none',
    id_type: req.user.kyc_id_type || '',
    reject_reason: req.user.kyc_reject_reason || '',
  });
});

// Seller: submit (allowed when status is none or rejected)
router.post('/', requireRole('seller'), async (req, res, next) => {
  try {
    const id_type = String(req.body.id_type || '');
    if (!ID_TYPES.includes(id_type)) return res.status(400).json({ error: 'Choose an ID type' });
    const id_image = parseImage(req.body.id_image, 'The ID photo');
    const selfie = parseImage(req.body.selfie, 'The selfie');

    // Atomic claim: cannot resubmit while pending or after being verified
    const claimed = await User.findOneAndUpdate(
      { _id: req.user._id, kyc_status: { $nin: ['pending', 'verified'] } },
      { kyc_status: 'pending', kyc_id_type: id_type, kyc_reject_reason: '' },
      { new: true }
    );
    if (!claimed) return res.status(409).json({ error: 'Your verification is already pending or approved' });

    try {
      // KV-KYC-STORE
      const prev = await KycSubmission.findOne({ user: req.user._id });
      let stored = [id_image, selfie];
      if (kycCloudConfigured()) {
        try {
          stored = await storeImages([id_image, selfie]);
        } catch (err2) {
          console.error('[kyc] photo upload failed:', err2.message);
          throw badRequest('Could not store your photos right now. Please try again.');
        }
      }
      await KycSubmission.findOneAndUpdate(
        { user: req.user._id },
        { user: req.user._id, id_type, id_image: stored[0], selfie: stored[1], $unset: { delete_after: 1 } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      // KV-KYC-OLD
      if (prev) {
        for (const old of [prev.id_image, prev.selfie]) {
          if (old && old.cloud_id) destroyPrivate(old).catch((e2) => console.error('[kyc] could not delete old photo:', e2.message));
        }
      }
    } catch (err) {
      await User.updateOne({ _id: req.user._id }, { kyc_status: req.user.kyc_status || 'none' });
      throw err;
    }

    notifyAdmins({ type: 'info', title: 'Seller verification to review', body: req.user.full_name, link: '/admin' }).catch(() => {});
    res.status(201).json({ status: 'pending' });
  } catch (e) {
    if (e.status === 400) return res.status(400).json({ error: e.message });
    next(e);
  }
});

/* ------------------------------------------------------------ ADMIN */

router.get('/pending', requireAdmin, async (_req, res, next) => {
  try {
    const users = await User.find({ kyc_status: 'pending' }).select('full_name email country kyc_id_type');
    const subs = await KycSubmission.find({ user: { $in: users.map((u) => u._id) } }).select('user updated_at');
    const when = new Map(subs.map((s) => [String(s.user), s.updated_at]));
    res.json(
      users
        .map((u) => ({
          id: u.id,
          full_name: u.full_name,
          email: u.email,
          country: u.country,
          id_type: u.kyc_id_type,
          submitted_at: when.get(String(u._id)) || null,
        }))
        .sort((a, b) => new Date(a.submitted_at || 0) - new Date(b.submitted_at || 0))
    );
  } catch (e) { next(e); }
});

router.get('/:userId/images', requireAdmin, async (req, res, next) => {
  try {
    if (!validId(req.params.userId)) return res.status(404).json({ error: 'Submission not found' });
    const s = await KycSubmission.findOne({ user: req.params.userId });
    if (!s) return res.status(404).json({ error: 'Submission not found' });
    res.set('Cache-Control', 'no-store');
    // KV-KYC-READ
    const show = async (img) => {
      if (img.cloud_id) {
        const buf = await fetchPrivate(img);
        if (!buf) throw new Error('Could not load the photo');
        return 'data:' + img.mime + ';base64,' + buf.toString('base64');
      }
      return toDataUrl(img);
    };
    res.json({ id_image: await show(s.id_image), selfie: await show(s.selfie) });
  } catch (e) { next(e); }
});

router.post('/:userId/approve', requireAdmin, async (req, res, next) => {
  try {
    if (!validId(req.params.userId)) return res.status(404).json({ error: 'Pending verification not found' });
    const u = await User.findOneAndUpdate(
      { _id: req.params.userId, role: 'seller', kyc_status: 'pending' },
      { kyc_status: 'verified', kyc_reject_reason: '' },
      { new: true }
    );
    if (!u) return res.status(404).json({ error: 'Pending verification not found' });
    scheduleDelete(u._id); // KV-KYC-KEEP-A
    notify(u._id, { type: 'info', title: 'You are verified', body: 'Your listings now show the Verified seller badge.', link: '/settings' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.post('/:userId/reject', requireAdmin, async (req, res, next) => {
  try {
    if (!validId(req.params.userId)) return res.status(404).json({ error: 'Pending verification not found' });
    const reason = typeof req.body.reason === 'string' ? req.body.reason.trim().slice(0, 300) : '';
    if (reason.length < 5) return res.status(400).json({ error: 'Give the seller a short reason' });
    const u = await User.findOneAndUpdate(
      { _id: req.params.userId, role: 'seller', kyc_status: 'pending' },
      { kyc_status: 'rejected', kyc_reject_reason: reason },
      { new: true }
    );
    if (!u) return res.status(404).json({ error: 'Pending verification not found' });
    scheduleDelete(u._id); // KV-KYC-KEEP-R
    notify(u._id, { type: 'info', title: 'Verification not approved', body: reason.slice(0, 200), link: '/settings' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;