// KV-AUTH v2
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { sendPasswordReset, sendPasswordChanged, sendWelcome } from '../lib/mailer.js';
import { cleanName, cleanEmail, passwordError, isStr } from '../lib/validate.js';

const router = Router();

const sign = (user, remember) =>
  jwt.sign({ sub: user._id.toString() }, process.env.JWT_SECRET, {
    expiresIn: remember ? '30d' : '1d',
  });

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

// Compared against when the email is unknown, so a wrong email takes as long as a wrong password
const DUMMY_HASH = bcrypt.hashSync('kv-dummy-password', 12);

router.post('/signup', async (req, res, next) => {
  try {
    const b = req.body || {};
    const name = cleanName(b.name);
    const email = cleanEmail(b.email);
    const country = isStr(b.country) ? b.country.trim().slice(0, 80) : '';
    if (!name) return res.status(400).json({ error: 'Enter your full name (2 to 80 characters)' });
    if (!email) return res.status(400).json({ error: 'Enter a valid email address' });
    if (!country) return res.status(400).json({ error: 'Choose your country' });
    if (!['buyer', 'seller'].includes(b.role)) return res.status(400).json({ error: 'Invalid role' });
    const pwErr = passwordError(b.password);
    if (pwErr) return res.status(400).json({ error: pwErr });

    if (await User.findOne({ email })) return res.status(409).json({ error: 'Email already in use' });

    const user = await User.create({
      full_name: name,
      email,
      country,
      role: b.role,
      password_hash: await bcrypt.hash(b.password, 12),
    });
    sendWelcome(user.email, user.full_name, user.role);
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
      const origin = (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',')[0];
      const link = `${origin}/reset-password?token=${token}`;
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
    await user.save();
    sendPasswordChanged(user.email, user.full_name);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;