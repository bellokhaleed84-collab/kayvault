import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not logged in' });

  try {
    const { sub, iat } = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(sub);
    if (!user) return res.status(401).json({ error: 'Account not found' });
    if (user.suspended) return res.status(403).json({ error: 'This account has been suspended. Contact support.' });
    // KV-SEC-SESSION: a login made before the last password reset is no longer valid
    if (user.password_changed_at && iat < Math.floor(user.password_changed_at.getTime() / 1000)) {
      return res.status(401).json({ error: 'Session expired, please log in again' });
    }
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Session expired, please log in again' });
  }
}

export const requireRole = (role) => (req, res, next) =>
  req.user.role === role ? next() : res.status(403).json({ error: 'Not allowed' });

export const requireAdmin = (req, res, next) =>
  req.user.is_admin ? next() : res.status(403).json({ error: 'Admins only' });

// KV-SEC-VERIFY: use after requireAuth on routes that buy, list or move money
export const requireVerified = (req, res, next) =>
  req.user.email_unverified === true
    ? res.status(403).json({ error: 'Please verify your email first. Check your inbox for the link.', code: 'EMAIL_NOT_VERIFIED' })
    : next();