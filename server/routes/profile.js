// KV-PROFILE v2
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { requireAuth } from '../middleware/auth.js';
import { sendPasswordChanged } from '../lib/mailer.js';
import { cleanName, cleanLine, passwordError, isStr } from '../lib/validate.js';
import { COUNTRIES, SELLER_COUNTRY } from '../lib/regions.js';
import { nigerianBanks } from '../lib/paystack.js';

const router = Router();
router.use(requireAuth);

// KV-PROF-BANKLIST: live list of Nigerian banks (from Paystack, cached)
router.get('/banks', async (_req, res) => {
  try {
    const banks = await nigerianBanks();
    res.json({ banks: banks.map((b) => b.name) });
  } catch {
    res.status(503).json({ error: 'Could not load the bank list. Try again in a minute.' });
  }
});

// Only these fields can ever be changed by the user (never role / is_admin)
router.patch('/', async (req, res, next) => {
  try {
    const b = req.body || {};
    const u = req.user;
    if (b.full_name !== undefined) {
      const n = cleanName(b.full_name);
      if (!n) return res.status(400).json({ error: 'Enter your full name (2 to 80 characters)' });
      u.full_name = n;
    }
    if (b.country !== undefined) {
      const c = isStr(b.country) ? b.country.trim().slice(0, 80) : '';
      if (!c) return res.status(400).json({ error: 'Choose your country' });
      if (!COUNTRIES.includes(c)) return res.status(400).json({ error: 'Choose one of the listed countries' }); // KV-PROF-COUNTRY
      if (u.role === 'seller' && c !== SELLER_COUNTRY) return res.status(400).json({ error: 'Sellers must be in Nigeria for now' });
      u.country = c;
    }
    if (typeof b.notify_email === 'boolean') u.notify_email = b.notify_email;
    if (u.role === 'seller') {
      if (b.bank_name !== undefined) { // KV-PROF-BANKCHECK
        const wanted = cleanLine(b.bank_name, 60);
        if (!wanted) {
          u.bank_name = '';
        } else {
          let banks;
          try { banks = await nigerianBanks(); } catch { return res.status(503).json({ error: 'Could not load the bank list. Try again in a minute.' }); }
          const hit = banks.find((x) => x.name.toLowerCase() === wanted.toLowerCase());
          if (!hit) return res.status(400).json({ error: 'Choose your bank from the list' });
          u.bank_name = hit.name;
        }
      }
      if (b.bank_account_number !== undefined) {
        const digits = isStr(b.bank_account_number) ? b.bank_account_number.replace(/\D/g, '') : '';
        if (digits && digits.length !== 10) return res.status(400).json({ error: 'A Nigerian account number has 10 digits' });
        u.bank_account_number = digits;
      }
      if (b.bank_account_name !== undefined) u.bank_account_name = cleanLine(b.bank_account_name, 100);
    }
    await u.save();
    res.json({ user: u });
  } catch (e) {
    next(e);
  }
});

router.post('/password', async (req, res, next) => {
  try {
    const b = req.body || {};
    const pwErr = passwordError(b.new_password);
    if (pwErr) return res.status(400).json({ error: pwErr });
    if (!isStr(b.current_password) || !b.current_password || !(await bcrypt.compare(b.current_password, req.user.password_hash)))
      return res.status(401).json({ error: 'Current password is incorrect' });
    if (b.new_password === b.current_password)
      return res.status(400).json({ error: 'The new password must be different from the current one' });
    req.user.password_hash = await bcrypt.hash(b.new_password, 12);
    await req.user.save();
    sendPasswordChanged(req.user.email, req.user.full_name);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;