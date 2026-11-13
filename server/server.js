import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';

import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js';
import listingRoutes from './routes/listings.js';
import purchaseRoutes, { sweepExpired } from './routes/purchases.js';
import reviewRoutes from './routes/reviews.js';
import notificationRoutes from './routes/notifications.js';
import paymentRoutes from './routes/payments.js';
import payoutRoutes from './routes/payouts.js';
import adminRoutes from './routes/admin.js';
import kycRoutes from './routes/kyc.js';
import proofRoutes from './routes/proofs.js';
import disputeRoutes from './routes/disputes.js';
import { sweepProofs } from './lib/proofSweep.js';
import { sweepKyc } from './lib/kycSweep.js';
import { sweepPayments } from './routes/payments.js';
import caseRoutes from './routes/cases.js';
import withdrawalRoutes from './routes/withdrawals.js';
import { sweepWithdrawals } from './lib/withdrawals.js'; // KV-WD-SIMP
import topupRoutes, { sweepTopups } from './routes/topups.js'; // KV-TOPUP-IMP
import orderChatRoutes from './routes/orderChat.js'; // KV-ORDERCHAT
import twofaRoutes from './routes/twofa.js'; // KV-TWOFA
import { trackRequests, noteError } from './lib/monitor.js'; // KV-MONITOR
import { requireAuth, requireVerified, requireBankSettled } from './middleware/auth.js'; // KV-SEC-GATE

const { MONGODB_URI, JWT_SECRET, CLIENT_ORIGIN, PORT = 5000 } = process.env;
if (!MONGODB_URI || !JWT_SECRET) {
  console.error('Missing MONGODB_URI or JWT_SECRET in .env');
  process.exit(1);
}

const app = express();
app.set('trust proxy', 1); // KV-TRUST-PROXY: Render sits behind one proxy, so rate limits see the real visitor IP
app.use(helmet());
app.use(cors({ origin: (CLIENT_ORIGIN || 'http://localhost:5173').split(',') }));
app.use(express.json({ limit: '6mb', verify: (req, _res, buf) => { req.rawBody = buf; } }));
app.use(trackRequests); // KV-MONITOR: counts requests, errors and slow pages for the admin Monitor tab

// KV-P17-NOAUTHLIMIT: the old blanket /api/auth limit was removed (it counted /auth/me on every page load)
// KV-SEC-LIMITS: sensitive routes allow 5 tries per 5 minutes
const limit = (windowMs, max, message, extra = {}) =>
  rateLimit({ windowMs, max, standardHeaders: true, legacyHeaders: false, message: { error: message }, ...extra });
const FIVE_MIN = 5 * 60 * 1000;
app.use('/api', limit(60 * 1000, 300, 'Too many requests. Slow down and try again in a minute.'));
app.use('/api/auth/login', limit(FIVE_MIN, 5, 'Too many login attempts. Try again in 5 minutes.', { skipSuccessfulRequests: true }));
app.use('/api/auth/login', limit(FIVE_MIN, 5, 'Too many attempts for this account. Try again in 5 minutes.', { skipSuccessfulRequests: true, keyGenerator: (req) => 'e:' + String((req.body && req.body.email) || '').toLowerCase().slice(0, 254) })); // KV-P17-EMAILLIMIT
app.use('/api/auth/signup', limit(FIVE_MIN, 5, 'Too many sign-ups from this network. Try again in 5 minutes.'));
app.use('/api/auth/forgot-password', limit(FIVE_MIN, 5, 'Too many reset requests. Try again in 5 minutes.'));
app.use('/api/auth/reset-password', limit(FIVE_MIN, 5, 'Too many attempts. Try again in 5 minutes.'));
app.use('/api/auth/verify-email', limit(FIVE_MIN, 5, 'Too many attempts. Try again in 5 minutes.'));
app.use('/api/auth/resend-verification', limit(FIVE_MIN, 5, 'Too many requests. Try again in 5 minutes.'));
app.use('/api/profile/password', limit(FIVE_MIN, 5, 'Too many password attempts. Try again in 5 minutes.'));
app.use('/api/listings', limit(60 * 60 * 1000, 40, 'Too many listing changes. Try again later.', {
  skip: (req) => !(req.method === 'PATCH' || (req.method === 'POST' && req.path === '/')),
}));

// KV-SEC-GATE: checks that run BEFORE the money routes.
// 1) Email must be confirmed (only when EMAIL_VERIFY_REQUIRED=true).  2) Withdrawals pause for 24 hours after a bank change.
const gate = [requireAuth, requireVerified];
app.post('/api/payments/initialize', ...gate); // pay for an account
app.use('/api/topups/checkout', ...gate); // pay for a top-up (both providers)
app.post('/api/listings', ...gate); // create a listing
app.patch('/api/listings/:id', ...gate); // edit a listing
app.post('/api/withdrawals', ...gate, requireBankSettled); // withdraw money

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/payouts', payoutRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/kyc', kycRoutes);
app.use('/api/proofs', proofRoutes);
app.use('/api/disputes', disputeRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/withdrawals', withdrawalRoutes); // KV-WD-SROUTE
app.use('/api/topups', topupRoutes); // KV-TOPUP-ROUTE
app.use('/api/order-chat', orderChatRoutes); // KV-ORDERCHAT
app.use('/api/twofa', twofaRoutes); // KV-TWOFA

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, _next) => {
  noteError(req, err); // KV-MONITOR
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log('MongoDB connected');
    // Release orders the buyer never answered within 24 hours
    const sweep = () => sweepExpired().then((n) => n && console.log(`Auto-released ${n} order(s)`)).catch((e) => console.error('Sweep failed:', e.message));
    sweep();
    setInterval(sweep, 5 * 60 * 1000);
    // Delete resolved refund proofs from Cloudinary once their 30 days are over
    const sweepP = () => sweepProofs().then((n) => n && console.log('Deleted ' + n + ' old proof file(s)')).catch((e) => console.error('Proof sweep failed:', e.message));
    setTimeout(sweepP, 30 * 1000);
    setInterval(sweepP, 60 * 60 * 1000);
    // KV-KYC-SWEEP-TIMER: delete reviewed KYC photos once their retention period is over
    const sweepK = () => sweepKyc().then((n) => n && console.log('Deleted ' + n + ' old verification record(s)')).catch((e) => console.error('KYC sweep failed:', e.message));
    setTimeout(sweepK, 45 * 1000);
    setInterval(sweepK, 60 * 60 * 1000);
    // KV-PAY-SWEEP-TIMER: deliver paid orders the webhook or callback missed
    const sweepPay = () => sweepPayments().then((n) => n && console.log('Recovered ' + n + ' payment(s)')).catch((e) => console.error('Payment sweep failed:', e.message));
    setTimeout(sweepPay, 60 * 1000);
    setInterval(sweepPay, 5 * 60 * 1000);
    // KV-WD-SWEEP-TIMER: settle withdrawals that Paystack confirmed but the webhook missed
    const sweepW = () => sweepWithdrawals().then((n) => n && console.log('Settled ' + n + ' withdrawal(s)')).catch((e) => console.error('Withdrawal sweep failed:', e.message));
    setTimeout(sweepW, 75 * 1000);
    setInterval(sweepW, 5 * 60 * 1000);
    // KV-TOPUP-SWEEP-TIMER: finish paid top-ups the page or webhook missed, and poll GamesDrop for delivery
    const sweepT = () => sweepTopups().then((n) => n && console.log('Top-up sweep handled ' + n + ' order(s)')).catch((e) => console.error('Top-up sweep failed:', e.message));
    setTimeout(sweepT, 90 * 1000);
    setInterval(sweepT, 2 * 60 * 1000);
    app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
  })
  .catch((e) => {
    console.error('MongoDB connection failed:', e.message);
    process.exit(1);
  });