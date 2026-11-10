// KV-TWOFA v1: the buyer asks for the current authenticator code of an account they bought
import { Router } from 'express';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import Listing from '../models/Listing.js';
import Purchase from '../models/Purchase.js';
import { decryptJson } from '../lib/crypto.js';
import { current } from '../lib/totp.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const validId = (id) => mongoose.isValidObjectId(id);
const SHOW_AFTER_RELEASE_MS = 3 * 24 * 60 * 60 * 1000; // codes stay available 3 days after the payment is released
const codeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 120,
  keyGenerator: (req) => String(req.user._id),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many code requests. Please try again later.' },
});

function allowed(p) {
  if (p.escrow_status === 'held' || p.escrow_status === 'refund_requested') return true;
  if (p.escrow_status === 'released') return Boolean(p.released_at) && Date.now() - new Date(p.released_at).getTime() < SHOW_AFTER_RELEASE_MS;
  return false;
}

// How does this order deliver 2FA codes? (never returns the key)
router.get('/order/:id', requireRole('buyer'), async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ error: 'Order not found' });
    const p = await Purchase.findOne({ _id: req.params.id, buyer: req.user._id }).select('listing escrow_status released_at');
    if (!p) return res.status(404).json({ error: 'Order not found' });
    const l = await Listing.findById(p.listing).select('twofa_mode');
    res.set('Cache-Control', 'no-store');
    res.json({ mode: (l && l.twofa_mode) || 'none', available: allowed(p) });
  } catch (e) { next(e); }
});

// The code to type into the game right now
router.post('/order/:id/code', requireRole('buyer'), codeLimiter, async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ error: 'Order not found' });
    const p = await Purchase.findOne({ _id: req.params.id, buyer: req.user._id }).select('listing escrow_status released_at');
    if (!p) return res.status(404).json({ error: 'Order not found' });
    if (!allowed(p)) return res.status(403).json({ error: 'Login codes are no longer available for this order' });

    const l = await Listing.findById(p.listing).select('+twofa_enc twofa_mode');
    if (!l || l.twofa_mode !== 'authenticator' || !l.twofa_enc) {
      return res.status(404).json({ error: 'This account does not use an authenticator app. Ask the seller for the code in the chat.' });
    }
    let secret;
    try {
      secret = decryptJson(l.twofa_enc).secret;
    } catch {
      return res.status(500).json({ error: 'Could not make a code. Please ask the seller in the chat.' });
    }
    res.set('Cache-Control', 'no-store');
    res.json(current(secret));
  } catch (e) { next(e); }
});

export default router;