import express, { Router } from 'express';
import mongoose from 'mongoose';
import Purchase from '../models/Purchase.js';
import RefundProof from '../models/RefundProof.js';
import { notifyAdmins } from '../lib/notify.js';
import { cloudConfigured, uploadBuffer, fetchAsset, destroyAsset } from '../lib/cloudinary.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
const MAX_BYTES = 14 * 1024 * 1024; // MongoDB documents are limited to 16 MB
const MAX_FILES = 4;
const validId = (id) => mongoose.isValidObjectId(id);

// Look at the real bytes of the file, never at what the browser says it is.
function sniff(b) {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  const head = b.subarray(0, 4).toString('latin1');
  if (head === 'GIF8') return 'image/gif';
  if (head === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return 'video/webm';
  if (b.subarray(4, 8).toString('latin1') === 'ftyp') {
    const brand = b.subarray(8, 12).toString('latin1');
    if (/^(heic|heix|hevc|hevx|heim|heis|mif1|msf1|avif)/.test(brand)) return 'unsupported';
    return brand === 'qt  ' ? 'video/quicktime' : 'video/mp4';
  }
  return null;
}

// Reads the raw file body (one file per request) and turns parser errors into clear messages
function rawBody(req, res, next) {
  express.raw({ type: () => true, limit: MAX_BYTES })(req, res, (err) => {
    if (!err) return next();
    if (err.type === 'entity.too.large' || err.status === 413) {
      return res.status(413).json({ error: 'That file is too large. Keep each file under 14 MB: trim the recording or use a screenshot.' });
    }
    res.status(400).json({ error: 'Upload failed. Please try again.' });
  });
}

router.use(requireAuth);

// Buyer: add one proof file to an order that is still open for a refund request
router.post('/purchase/:id', requireRole('buyer'), rawBody, async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ error: 'Order not found' });
    const p = await Purchase.findOne({ _id: req.params.id, buyer: req.user._id, escrow_status: 'held' });
    if (!p) return res.status(404).json({ error: 'Order not found, or it is no longer open for a refund request' });
    if (p.confirm_deadline && p.confirm_deadline <= new Date()) {
      return res.status(400).json({ error: 'The 24 hour window has closed' });
    }
    if ((await RefundProof.countDocuments({ purchase: p._id })) >= MAX_FILES) {
      return res.status(400).json({ error: `You can add up to ${MAX_FILES} files. Remove one first.` });
    }

    const body = req.body;
    if (!Buffer.isBuffer(body) || body.length === 0) return res.status(400).json({ error: 'No file received' });
    const mime = sniff(body);
    if (mime === 'unsupported') {
      return res.status(415).json({ error: 'That photo format is not supported. Take a screenshot instead (PNG or JPG), or record the screen as MP4.' });
    }
    if (!mime) {
      return res.status(415).json({ error: 'Only screenshots (JPG, PNG, WebP, GIF) and screen recordings (MP4, MOV, WebM) are allowed' });
    }

    const name = String(req.query.name || 'proof').replace(/[^\w.\- ]/g, '').slice(0, 100) || 'proof';
    // KV-CLOUD-UPLOAD
    let proof;
    if (cloudConfigured()) {
      let up;
      try {
        up = await uploadBuffer(body, mime.startsWith('video/') ? 'video' : 'image', 'kayvault/proofs', mime);
      } catch (err) {
        console.error('[cloudinary] upload failed:', err.message);
        return res.status(502).json({ error: 'Could not store the file right now. Please try again.' });
      }
      proof = await RefundProof.create({ purchase: p._id, buyer: req.user._id, name, mime, size: body.length, cloud_id: up.public_id, cloud_type: up.resource_type, cloud_url: up.secure_url });
    } else {
      proof = await RefundProof.create({ purchase: p._id, buyer: req.user._id, name, mime, size: body.length, data: body });
    }

    // Two uploads at the same moment must not slip past the limit
    if ((await RefundProof.countDocuments({ purchase: p._id })) > MAX_FILES) {
      await RefundProof.deleteOne({ _id: proof._id });
      return res.status(400).json({ error: `You can add up to ${MAX_FILES} files. Remove one first.` });
    }
    res.status(201).json({ proof });
  } catch (e) { next(e); }
});

// KV-SELLER-PROOF: the seller adds one proof file to an open refund case. Only admin can see it.
router.post('/seller/:id', requireRole('seller'), rawBody, async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ error: 'Refund request not found' });
    const p = await Purchase.findOne({ _id: req.params.id, seller: req.user._id, escrow_status: 'refund_requested' });
    if (!p) return res.status(404).json({ error: 'Refund request not found, or it is already closed' });
    if ((await RefundProof.countDocuments({ purchase: p._id, role: 'seller' })) >= MAX_FILES) {
      return res.status(400).json({ error: `You can add up to ${MAX_FILES} files.` });
    }

    const body = req.body;
    if (!Buffer.isBuffer(body) || body.length === 0) return res.status(400).json({ error: 'No file received' });
    const mime = sniff(body);
    if (mime === 'unsupported') {
      return res.status(415).json({ error: 'That photo format is not supported. Use a screenshot (PNG or JPG), or record the screen as MP4.' });
    }
    if (!mime) {
      return res.status(415).json({ error: 'Only screenshots (JPG, PNG, WebP, GIF) and screen recordings (MP4, MOV, WebM) are allowed' });
    }

    const name = String(req.query.name || 'proof').replace(/[^\w.\- ]/g, '').slice(0, 100) || 'proof';
    const base = { purchase: p._id, buyer: p.buyer, role: 'seller', name, mime, size: body.length };
    let proof;
    if (cloudConfigured()) {
      let up;
      try {
        up = await uploadBuffer(body, mime.startsWith('video/') ? 'video' : 'image', 'kayvault/proofs', mime);
      } catch (err) {
        console.error('[cloudinary] upload failed:', err.message);
        return res.status(502).json({ error: 'Could not store the file right now. Please try again.' });
      }
      proof = await RefundProof.create({ ...base, cloud_id: up.public_id, cloud_type: up.resource_type, cloud_url: up.secure_url });
    } else {
      proof = await RefundProof.create({ ...base, data: body });
    }

    if ((await RefundProof.countDocuments({ purchase: p._id, role: 'seller' })) > MAX_FILES) {
      await RefundProof.deleteOne({ _id: proof._id });
      if (proof.cloud_id) await destroyAsset(proof).catch(() => {});
      return res.status(400).json({ error: `You can add up to ${MAX_FILES} files.` });
    }
    notifyAdmins({ type: 'order', title: 'Seller added proof to a refund case', body: p.game, link: '/admin' }).catch(() => {});
    res.status(201).json({ proof });
  } catch (e) { next(e); }
});

// Seller: the names of the proof files they added to their own order (never the files themselves)
router.get('/seller/:id', requireRole('seller'), async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ error: 'Refund request not found' });
    if (!(await Purchase.exists({ _id: req.params.id, seller: req.user._id }))) return res.status(404).json({ error: 'Refund request not found' });
    const proofs = await RefundProof.find({ purchase: req.params.id, role: 'seller' }).sort({ created_at: 1 });
    res.json({ proofs });
  } catch (e) { next(e); }
});

// Buyer (own order) or admin: the proof files of an order, without the file contents
router.get('/purchase/:id', async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ error: 'Order not found' });
    const filter = req.user.is_admin ? { _id: req.params.id } : { _id: req.params.id, buyer: req.user._id };
    if (!(await Purchase.exists(filter))) return res.status(404).json({ error: 'Order not found' });
    const proofFilter = req.user.is_admin ? { purchase: req.params.id } : { purchase: req.params.id, role: { $ne: 'seller' } }; // KV-PROOF-LIST
    const proofs = await RefundProof.find(proofFilter).sort({ created_at: 1 });
    res.json({ proofs });
  } catch (e) { next(e); }
});

// Buyer (own file) or admin: the file itself
router.get('/file/:proofId', async (req, res, next) => {
  try {
    if (!validId(req.params.proofId)) return res.status(404).json({ error: 'File not found' });
    const proof = await RefundProof.findById(req.params.proofId).select('+data');
    if (!proof) return res.status(404).json({ error: 'File not found' });
    if (!req.user.is_admin && (proof.role === 'seller' || String(proof.buyer) !== String(req.user._id))) { // KV-PROOF-HIDE
      return res.status(404).json({ error: 'File not found' });
    }
    res.set({ 'Content-Type': proof.mime, 'Cache-Control': 'private, no-store', 'Content-Disposition': 'inline' });
    // KV-CLOUD-READ
    if (proof.cloud_id) {
      const buf = await fetchAsset(proof);
      if (!buf) return res.status(502).json({ error: 'Could not load the file' });
      return res.send(buf);
    }
    res.send(proof.data);
  } catch (e) { next(e); }
});

// Buyer: remove a file, but only before the refund request is sent. After that it is evidence.
router.delete('/file/:proofId', requireRole('buyer'), async (req, res, next) => {
  try {
    if (!validId(req.params.proofId)) return res.status(404).json({ error: 'File not found' });
    const proof = await RefundProof.findOne({ _id: req.params.proofId, buyer: req.user._id });
    if (!proof) return res.status(404).json({ error: 'File not found' });
    if (!(await Purchase.exists({ _id: proof.purchase, escrow_status: 'held' }))) {
      return res.status(400).json({ error: 'This file is part of a refund request and cannot be removed' });
    }
    await RefundProof.deleteOne({ _id: proof._id });
    // KV-CLOUD-DELETE
    if (proof.cloud_id) await destroyAsset(proof).catch((e) => console.error('[cloudinary] delete failed:', e.message));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;