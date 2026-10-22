import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { requireAuth } from '../middleware/auth.js';
import { sendPasswordChanged } from '../lib/mailer.js';

const router = Router();
router.use(requireAuth);

// Only these fields can ever be changed by the user (never role / is_admin)
router.patch('/', async (req, res, next) => {
  try {
    const { full_name, country, notify_email, bank_name, bank_account_number, bank_account_name } = req.body;
    const u = req.user;
    if (typeof full_name === 'string' && full_name.trim()) u.full_name = full_name.trim();
    if (typeof country === 'string' && country) u.country = country;
    if (typeof notify_email === 'boolean') u.notify_email = notify_email;
    if (u.role === 'seller') {
      if (typeof bank_name === 'string') u.bank_name = bank_name;
      if (typeof bank_account_number === 'string') u.bank_account_number = bank_account_number.replace(/\D/g, '').slice(0, 10);
      if (typeof bank_account_name === 'string') u.bank_account_name = bank_account_name;
    }
    await u.save();
    res.json({ user: u });
  } catch (e) {
    next(e);
  }
});

router.post('/password', async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body;
    if (!new_password || new_password.length < 8)
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    if (!current_password || !(await bcrypt.compare(current_password, req.user.password_hash)))
      return res.status(401).json({ error: 'Current password is incorrect' });
    req.user.password_hash = await bcrypt.hash(new_password, 12);
    await req.user.save();
    sendPasswordChanged(req.user.email, req.user.full_name);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
