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

// KV-SEC-VERIFY: blocks buying, listing and withdrawing until the email is confirmed.
// Does nothing unless EMAIL_VERIFY_REQUIRED=true on the server.
export const requireVerified = (req, res, next) =>
  process.env.EMAIL_VERIFY_REQUIRED === 'true' && req.user.email_unverified === true
    ? res.status(403).json({ error: 'Please confirm your email first. Check your inbox for the link.', code: 'EMAIL_NOT_VERIFIED' })
    : next();

// KV-SEC-BANK: after existing bank details are changed, withdrawals wait 24 hours
const BANK_HOLD_MS = 24 * 60 * 60 * 1000;
export function requireBankSettled(req, res, next) {
  const at = req.user.bank_changed_at;
  const left = at ? BANK_HOLD_MS - (Date.now() - at.getTime()) : 0;
  if (left > 0) {
    const hours = Math.ceil(left / 3600000);
    return res.status(403).json({
      error: `You changed your bank details recently. For your safety, withdrawals open again in about ${hours} ${hours === 1 ? 'hour' : 'hours'}.`,
    });
  }
  next();
}