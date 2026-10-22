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
import caseRoutes from './routes/cases.js';

const { MONGODB_URI, JWT_SECRET, CLIENT_ORIGIN, PORT = 5000 } = process.env;
if (!MONGODB_URI || !JWT_SECRET) {
  console.error('Missing MONGODB_URI or JWT_SECRET in .env');
  process.exit(1);
}

const app = express();
app.use(helmet());
app.use(cors({ origin: (CLIENT_ORIGIN || 'http://localhost:5173').split(',') }));
app.use(express.json({ limit: '6mb', verify: (req, _res, buf) => { req.rawBody = buf; } }));

app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 50 }));

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

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, _req, res, _next) => {
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
    app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
  })
  .catch((e) => {
    console.error('MongoDB connection failed:', e.message);
    process.exit(1);
  });
