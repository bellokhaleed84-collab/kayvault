import { Router } from 'express';
import mongoose from 'mongoose';
import Listing from '../models/Listing.js';
import Purchase from '../models/Purchase.js';
import User from '../models/User.js';
import Review from '../models/Review.js';
import { notify, notifyAdmins } from '../lib/notify.js';
import { encryptJson } from '../lib/crypto.js';
import { storeListingImages, removeListingImages } from '../lib/listingImages.js';
import { requireAuth, requireRole, requireAdmin } from '../middleware/auth.js';

const router = Router();

const LIGHT = '-images.data'; // never load image bytes in list queries
const PLATFORMS = ['PC', 'PlayStation', 'Xbox', 'Mobile', 'Other'];
const TYPES = ['standard', 'modded', 'smurf', 'fresh', 'other'];
const SORTS = {
  newest: { created_at: -1 },
  price_asc: { price: 1 },
  price_desc: { price: -1 },
};

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const badRequest = (msg) => Object.assign(new Error(msg), { status: 400 });

function parseImages(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, 4).map((s) => {
    const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(s));
    if (!m) throw badRequest('One of the images is not a valid JPEG, PNG or WebP');
    const data = Buffer.from(m[2], 'base64');
    if (data.length > 600 * 1024) throw badRequest('Each image must be under 600 KB');
    return { mime: m[1], data };
  });
}

/* ------------------------------------------------------------ PUBLIC */

router.get('/browse', async (req, res, next) => {
  try {
    const { q, game, min, max, type, platform } = req.query;
    const sort = Object.hasOwn(SORTS, req.query.sort) ? req.query.sort : 'newest';
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(24, parseInt(req.query.limit) || 12);

    const filter = { status: 'live', seller_suspended: { $ne: true } };
    if (game) filter.game = new RegExp(`^${esc(String(game).slice(0, 80))}$`, 'i');
    if (PLATFORMS.includes(String(platform))) filter.platform = String(platform);
    if (type) {
      const types = String(type).split(',').filter((t) => TYPES.includes(t));
      if (types.length) filter.account_type = { $in: types };
    }
    const price = {};
    if (Number(min) > 0) price.$gte = Number(min);
    if (Number(max) > 0) price.$lte = Number(max);
    if (Object.keys(price).length) filter.price = price;
    if (q) {
      const rx = new RegExp(esc(String(q).slice(0, 80)), 'i');
      filter.$or = [{ game: rx }, { tier: rx }, { description: rx }];
    }

    const [items, total] = await Promise.all([
      Listing.find(filter).select(LIGHT).sort(SORTS[sort]).skip((page - 1) * limit).limit(limit),
      Listing.countDocuments(filter),
    ]);
    res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
  } catch (e) { next(e); }
});

router.get('/featured', async (_req, res, next) => {
  try {
    res.json(await Listing.find({ status: 'live', seller_suspended: { $ne: true } }).select(LIGHT).sort({ created_at: -1 }).limit(4));
  } catch (e) { next(e); }
});

router.get('/games', async (req, res, next) => {
  try {
    const limit = Math.min(50, parseInt(req.query.limit) || 6);
    const rows = await Listing.aggregate([
      { $match: { status: 'live', seller_suspended: { $ne: true } } },
      { $project: { game: 1, n: { $size: { $ifNull: ['$images', []] } } } },
      {
        $group: {
          _id: '$game',
          count: { $sum: 1 },
          withImage: { $max: { $cond: [{ $gt: ['$n', 0] }, '$_id', null] } },
        },
      },
      { $sort: { count: -1, _id: 1 } },
      { $limit: limit },
    ]);
    res.json(
      rows.map((g) => ({
        game: g._id,
        count: g.count,
        cover: g.withImage ? `/api/listings/${g.withImage}/image/0` : null,
      }))
    );
  } catch (e) { next(e); }
});

router.get('/item/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Listing not found' });
    const listing = await Listing.findOne({ _id: req.params.id, status: { $in: ['live', 'sold'] }, seller_suspended: { $ne: true } }).select(LIGHT);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });

    const [seller, sales, ratingAgg, similar] = await Promise.all([
      User.findById(listing.seller).select('full_name created_at country kyc_status'),
      Purchase.countDocuments({ seller: listing.seller, escrow_status: 'released' }),
      Review.aggregate([{ $match: { seller: listing.seller } }, { $group: { _id: null, avg: { $avg: '$rating' }, n: { $sum: 1 } } }]),
      Listing.find({ game: listing.game, status: 'live', seller_suspended: { $ne: true }, _id: { $ne: listing._id } })
        .select(LIGHT).sort({ created_at: -1 }).limit(4),
    ]);
    res.json({
      listing,
      seller: {
        name: seller?.full_name || listing.seller_name,
        since: seller?.created_at || null,
        country: seller?.country || '',
        id: String(listing.seller),
        rating: ratingAgg[0] ? Math.round(ratingAgg[0].avg * 10) / 10 : null,
        verified: seller?.kyc_status === 'verified',
        reviews: ratingAgg[0] ? ratingAgg[0].n : 0,
        sales,
      },
      similar,
    });
  } catch (e) { next(e); }
});

router.get('/:id/image/:n', async (req, res, next) => {
  try {
    const n = parseInt(req.params.n);
    if (!mongoose.isValidObjectId(req.params.id) || !(n >= 0 && n < 10)) return res.status(404).end();
    const l = await Listing.findById(req.params.id).select('images');
    const img = l?.images?.[n];
    if (!img) return res.status(404).end();
    // KV-LIST-READ: images on Cloudinary are served from its CDN
    if (img.cloud_url) {
      res.set('Cache-Control', 'public, max-age=86400');
      res.set('Cross-Origin-Resource-Policy', 'cross-origin');
      return res.redirect(302, img.cloud_url.replace('/upload/', '/upload/f_auto,q_auto/'));
    }
    res.set('Content-Type', img.mime);
    res.set('Cache-Control', 'public, max-age=86400');
    res.set('Cross-Origin-Resource-Policy', 'cross-origin'); // frontend runs on another origin
    res.send(img.data);
  } catch (e) { next(e); }
});

/* ----------------------------------------------------- LOGGED IN */
router.use(requireAuth);

// Seller: own listings
router.get('/mine', requireRole('seller'), async (req, res, next) => {
  try {
    res.json(await Listing.find({ seller: req.user._id }).select(LIGHT).sort({ created_at: -1 }));
  } catch (e) { next(e); }
});

// KV-LIST-EDIT: seller loads one of their own listings for editing (never returns the login details)
router.get('/mine/:id', requireRole('seller'), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Listing not found' });
    const l = await Listing.findOne({ _id: req.params.id, seller: req.user._id }).select('-images.data +credentials_enc');
    if (!l) return res.status(404).json({ error: 'Listing not found' });
    const out = l.toJSON();
    out.has_credentials = Boolean(l.credentials_enc);
    out.locked = Boolean(l.reserved_until && l.reserved_until > new Date());
    res.json(out);
  } catch (e) { next(e); }
});

// Seller: edit a pending or live listing. A live listing whose public details change goes back to review.
router.patch('/:id', requireRole('seller'), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Listing not found' });
    const b = req.body || {};
    const cur = await Listing.findOne({ _id: req.params.id, seller: req.user._id }).select('+credentials_enc');
    if (!cur) return res.status(404).json({ error: 'Listing not found' });
    if (cur.status === 'sold') return res.status(409).json({ error: 'A sold listing cannot be edited' });
    if (cur.reserved_until && cur.reserved_until > new Date()) {
      return res.status(409).json({ error: 'A buyer is paying for this account right now. Try again in a few minutes.' });
    }

    const game = str(b.game, 80);
    const tier = str(b.tier, 200);
    const price = Number(b.price);
    if (!game || !tier || !Number.isFinite(price) || price <= 0 || price > 100000000) {
      return res.status(400).json({ error: 'Invalid listing details' });
    }
    const level = str(b.level, 60);
    const platform = PLATFORMS.includes(b.platform) ? b.platform : 'Other';
    const account_type = TYPES.includes(b.account_type) ? b.account_type : 'standard';
    const description = str(b.description, 2000);
    const features = Array.isArray(b.features) ? b.features.map((f) => str(f, 40)).filter(Boolean).slice(0, 8) : [];

    const login = str(b.account_login, 200);
    const password = typeof b.account_password === 'string' ? b.account_password.slice(0, 200) : '';
    const wantsCreds = Boolean(login || password);
    if (wantsCreds && (!login || !password)) {
      return res.status(400).json({ error: 'Enter both the login and the password, or leave both empty to keep the saved ones' });
    }

    const keepIdx = Array.isArray(b.keep_images)
      ? [...new Set(b.keep_images.map(Number).filter((i) => Number.isInteger(i) && i >= 0 && i < cur.images.length))]
      : cur.images.map((_, i) => i);
    const newParsed = parseImages(b.new_images);
    if (keepIdx.length + newParsed.length > 4) return res.status(400).json({ error: 'A listing can have up to 4 images' });

    const unchangedImages = newParsed.length === 0 && keepIdx.length === cur.images.length && keepIdx.every((v, i) => v === i);
    const same =
      cur.game === game && cur.tier === tier && cur.price === price && (cur.level || '') === level &&
      cur.platform === platform && cur.account_type === account_type && (cur.description || '') === description &&
      (cur.features || []).join('|') === features.join('|');
    const needsReview = cur.status === 'live' && !(same && unchangedImages);

    const kept = keepIdx.map((i) => cur.images[i].toObject());
    const removed = cur.images.filter((_, i) => !keepIdx.includes(i));
    const added = await storeListingImages(newParsed);

    const set = { game, tier, price, level, platform, account_type, description, features, images: [...kept, ...added] };
    if (wantsCreds) set.credentials_enc = encryptJson({ login, password, notes: str(b.account_notes, 500) });
    if (needsReview) set.status = 'pending';

    const upd = await Listing.findOneAndUpdate(
      {
        _id: cur._id,
        seller: req.user._id,
        status: cur.status,
        $or: [{ reserved_until: null }, { reserved_until: { $lte: new Date() } }],
      },
      { $set: set },
      { new: true, runValidators: true }
    ).select(LIGHT);
    if (!upd) {
      removeListingImages(added);
      return res.status(409).json({ error: 'This listing just changed, or a buyer started paying. Please try again.' });
    }
    removeListingImages(removed);
    if (needsReview) {
      notifyAdmins({ type: 'listing', title: 'Edited listing to review', body: `${game} by ${req.user.full_name}`, link: '/admin' }).catch(() => {});
    }
    res.json({ listing: upd, needs_review: needsReview });
  } catch (e) {
    if (e.status === 400) return res.status(400).json({ error: e.message });
    next(e);
  }
});

// Seller: delete a pending or live listing that no buyer is paying for
router.delete('/:id', requireRole('seller'), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Listing not found' });
    const l = await Listing.findOneAndDelete({
      _id: req.params.id,
      seller: req.user._id,
      status: { $in: ['pending', 'live'] },
      $or: [{ reserved_until: null }, { reserved_until: { $lte: new Date() } }],
    });
    if (!l) {
      const exists = await Listing.exists({ _id: req.params.id, seller: req.user._id });
      return res.status(exists ? 409 : 404).json({ error: exists ? 'This listing cannot be deleted right now. It may be sold, or a buyer is paying for it.' : 'Listing not found' });
    }
    removeListingImages(l.images);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Seller: real earnings / escrow numbers
router.get('/stats', requireRole('seller'), async (req, res, next) => {
  try {
    const purchases = await Purchase.find({ seller: req.user._id });
    const sum = (s) => purchases.filter((p) => p.escrow_status === s).reduce((t, p) => t + p.price, 0);
    const active = await Listing.countDocuments({ seller: req.user._id, status: 'live' });
    res.json({ earnings: sum('released'), in_escrow: sum('held') + sum('refund_requested'), active });
  } catch (e) { next(e); }
});

// Seller: create (always starts pending)
router.post('/', requireRole('seller'), async (req, res, next) => {
  try {
    const b = req.body;
    const game = str(b.game, 80);
    const tier = str(b.tier, 200);
    const price = Number(b.price);
    const login = str(b.account_login, 200);
    const password = typeof b.account_password === 'string' ? b.account_password.slice(0, 200) : '';
    if (!login || !password)
      return res.status(400).json({ error: 'Add the account login and password for delivery' });
    const creds = { login, password, notes: str(b.account_notes, 500) };
    if (!game || !tier || !Number.isFinite(price) || price <= 0 || price > 100000000)
      return res.status(400).json({ error: 'Invalid listing details' });

    const features = Array.isArray(b.features)
      ? b.features.map((f) => str(f, 40)).filter(Boolean).slice(0, 8)
      : [];

    const listing = await Listing.create({
      seller: req.user._id,
      seller_name: req.user.full_name,
      game,
      tier,
      price,
      level: str(b.level, 60),
      platform: PLATFORMS.includes(b.platform) ? b.platform : 'Other',
      account_type: TYPES.includes(b.account_type) ? b.account_type : 'standard',
      description: str(b.description, 2000),
      features,
      images: await storeListingImages(parseImages(b.images)), // KV-LIST-CREATE
      credentials_enc: encryptJson(creds),
      status: 'pending',
    });
    notifyAdmins({ type: 'listing', title: 'New listing to review', body: `${game} by ${req.user.full_name}`, link: '/admin' }).catch(() => {});
    res.status(201).json(listing);
  } catch (e) {
    if (e.status === 400) return res.status(400).json({ error: e.message });
    next(e);
  }
});

// Admin
router.get('/pending', requireAdmin, async (_req, res, next) => {
  try {
    res.json(await Listing.find({ status: 'pending' }).select(LIGHT).sort({ created_at: 1 }));
  } catch (e) { next(e); }
});

router.post('/:id/approve', requireAdmin, async (req, res, next) => {
  try {
    const l = await Listing.findOneAndUpdate({ _id: req.params.id, status: 'pending' }, { status: 'live' }, { new: true }).select(LIGHT);
    if (l) notify(l.seller, { type: 'listing', title: 'Listing approved', body: `${l.game} is now live.`, link: `/listing/${l.id}` });
    if (!l) return res.status(404).json({ error: 'Pending listing not found' });
    res.json(l);
  } catch (e) { next(e); }
});

router.delete('/:id/reject', requireAdmin, async (req, res, next) => {
  try {
    const l = await Listing.findOneAndDelete({ _id: req.params.id, status: 'pending' });
    if (l) removeListingImages(l.images); // KV-LIST-REJECT
    if (l) notify(l.seller, { type: 'listing', title: 'Listing not approved', body: `${l.game} was not approved. Check the details and submit it again.`, link: '/dashboard/seller/new' });
    if (!l) return res.status(404).json({ error: 'Pending listing not found' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;