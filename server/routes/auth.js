// KV-AUTH v3
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { sendPasswordReset, sendPasswordChanged, sendWelcome, sendVerifyEmail } from '../lib/mailer.js';
import { cleanName, cleanEmail, passwordError, isStr } from '../lib/validate.js';
import { COUNTRIES, SELLER_COUNTRY } from '../lib/regions.js';

const router = Router();

const sign = (user, remember) =>
  jwt.sign({ sub: user._id.toString() }, process.env.JWT_SECRET, {
    expiresIn: remember ? '30d' : '1d',
  });

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const origin = () => (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',')[0];

// Compared against when the email is unknown, so a wrong email takes as long as a wrong password
const DUMMY_HASH = bcrypt.hashSync('kv-dummy-password', 12);

// KV-SEC-VERIFY: makes a new verification token, returns the plain token (only its hash is stored)
function newVerifyToken() {
  const token = crypto.randomBytes(32).toString('hex');
  return {
    token,
    fields: {
      verify_token_hash: sha256(token),
      verify_expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      verify_sent_at: new Date(),
    },
  };
}

function mailVerify(user, token) {
  const link = `${origin()}/verify-email?token=${token}`;
  sendVerifyEmail(user.email, user.full_name, link).then((sent) => {
    if (!sent) console.log(`\n[email verify] ${user.email}\n${link}\n`);
  });
}

router.post('/signup', async (req, res, next) => {
  try {
    const b = req.body || {};
    const name = cleanName(b.name);
    const email = cleanEmail(b.email);
    const country = isStr(b.country) ? b.country.trim().slice(0, 80) : '';
    if (!name) return res.status(400).json({ error: 'Enter your full name (2 to 80 characters)' });
    if (!email) return res.status(400).json({ error: 'Enter a valid email address' });
    if (!country) return res.status(400).json({ error: 'Choose your country' });
    if (!COUNTRIES.includes(country)) return res.status(400).json({ error: 'Choose one of the listed countries' }); // KV-AUTH-COUNTRY
    if (b.role === 'seller' && country !== SELLER_COUNTRY) return res.status(400).json({ error: 'Sellers must be in Nigeria for now. Buyers can join from the listed countries.' });
    if (!['buyer', 'seller'].includes(b.role)) return res.status(400).json({ error: 'Invalid role' });
    if (b.accepted_terms !== true) return res.status(400).json({ error: 'You must accept the Terms of Service and Privacy Policy' }); // KV-P17B-SERVER
    const pwErr = passwordError(b.password);
    if (pwErr) return res.status(400).json({ error: pwErr });

    if (await User.findOne({ email })) return res.status(409).json({ error: 'Email already in use' });

    const v = newVerifyToken();
    const user = await User.create({
      full_name: name,
      email,
      country,
      role: b.role,
      password_hash: await bcrypt.hash(b.password, 12),
      terms_accepted_at: new Date(), // KV-P17B-USER
      email_unverified: true, // KV-SEC-VERIFY
      ...v.fields,
    });
    mailVerify(user, v.token);
    res.status(201).json({ token: sign(user, true), user });
  } catch (e) {
    if (e && e.code === 11000) return res.status(409).json({ error: 'Email already in use' });
    next(e);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const b = req.body || {};
    const email = cleanEmail(b.email);
    const password = isStr(b.password) && b.password.length <= 200 ? b.password : '';
    const user = email ? await User.findOne({ email }) : null;
    const match = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
    if (!user || !password || !match) return res.status(401).json({ error: 'Invalid email or password' });
    if (user.suspended) return res.status(403).json({ error: 'This account has been suspended. Contact support.' });
    res.json({ token: sign(user, b.remember !== false), user });
  } catch (e) {
    next(e);
  }
});

router.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));

// KV-SEC-VERIFY: the link in the email lands on a page that posts the token here
router.post('/verify-email', async (req, res, next) => {
  try {
    const token = (req.body || {}).token;
    if (!isStr(token) || !token || token.length > 200) return res.status(400).json({ error: 'This link is invalid or has expired' });
    const user = await User.findOne({ verify_token_hash: sha256(token), verify_expires: { $gt: new Date() } });
    if (!user) return res.status(400).json({ error: 'This link is invalid or has expired' });
    const wasUnverified = user.email_unverified === true;
    user.email_unverified = false;
    user.verify_token_hash = undefined;
    user.verify_expires = undefined;
    user.verify_sent_at = undefined;
    await user.save();
    if (wasUnverified) sendWelcome(user.email, user.full_name, user.role);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// KV-SEC-VERIFY: logged-in user asks for a new link. One per minute.
router.post('/resend-verification', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('+verify_sent_at');
    if (!user || user.email_unverified !== true) return res.json({ ok: true, already: true });
    if (user.verify_sent_at && Date.now() - user.verify_sent_at.getTime() < 60 * 1000) {
      return res.status(429).json({ error: 'Wait one minute before asking for another email.' });
    }
    const v = newVerifyToken();
    Object.assign(user, v.fields);
    await user.save();
    mailVerify(user, v.token);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// Always answers the same way so nobody can probe which emails exist.
// The reset link is emailed (Resend). Without RESEND_API_KEY, or if sending fails, it is printed in this server terminal instead.
router.post('/forgot-password', async (req, res, next) => {
  try {
    const email = cleanEmail((req.body || {}).email);
    const user = email && (await User.findOne({ email }).select('+reset_expires'));
    // A reset asked for in the last minute is not sent again, so nobody can flood an inbox
    const justAsked = user?.reset_expires && user.reset_expires.getTime() > Date.now() + 59 * 60 * 1000;
    if (user && !justAsked) {
      const token = crypto.randomBytes(32).toString('hex');
      user.reset_token_hash = sha256(token);
      user.reset_expires = new Date(Date.now() + 60 * 60 * 1000);
      await user.save();
      const link = `${origin()}/reset-password?token=${token}`;
      sendPasswordReset(email, user.full_name, link).then((sent) => {
        if (!sent) console.log(`\n[password reset] ${email}\n${link}\n`);
      });
    }
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.post('/reset-password', async (req, res, next) => {
  try {
    const b = req.body || {};
    const pwErr = passwordError(b.password);
    if (pwErr) return res.status(400).json({ error: pwErr });
    if (!isStr(b.token) || !b.token || b.token.length > 200)
      return res.status(400).json({ error: 'This reset link is invalid or has expired' });

    const user = await User.findOne({
      reset_token_hash: sha256(b.token),
      reset_expires: { $gt: new Date() },
    });
    if (!user) return res.status(400).json({ error: 'This reset link is invalid or has expired' });

    user.password_hash = await bcrypt.hash(b.password, 12);
    user.reset_token_hash = undefined;
    user.reset_expires = undefined;
    user.password_changed_at = new Date(); // KV-SEC-SESSION: every older login stops working
    // The link was emailed to this address, so using it also proves the email is real
    user.email_unverified = false;
    user.verify_token_hash = undefined;
    user.verify_expires = undefined;
    await user.save();
    sendPasswordChanged(user.email, user.full_name);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;