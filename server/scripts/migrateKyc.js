// KV-MIGRATEKYC v1
import 'dotenv/config';
import dns from 'node:dns';
import mongoose from 'mongoose';
import KycSubmission from '../models/KycSubmission.js';
import User from '../models/User.js';
import { kycCloudConfigured, storeImages, KEEP_DAYS } from '../lib/kycStore.js';

dns.setServers(['8.8.8.8', '1.1.1.1']);
if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI is missing in server/.env');
  process.exit(1);
}
const cloud = kycCloudConfigured();
if (!cloud) console.log('Cloudinary is not configured: photos stay in MongoDB, only deletion dates are set.');

await mongoose.connect(process.env.MONGODB_URI);
const ids = await KycSubmission.find().select('_id');
console.log(ids.length + ' submission(s) found');
let moved = 0;
let scheduled = 0;
let failed = 0;
for (const { _id } of ids) {
  try {
    const s = await KycSubmission.findById(_id);
    if (!s) continue;
    const u = await User.findById(s.user).select('kyc_status');
    const decided = !u || u.kyc_status !== 'pending';
    const set = {};
    if (cloud && !(s.id_image && s.id_image.cloud_id) && s.id_image && s.id_image.data && s.selfie && s.selfie.data) {
      const [a, b] = await storeImages([s.id_image, s.selfie]);
      set.id_image = a;
      set.selfie = b;
      moved++;
    }
    if (decided && !s.delete_after) {
      set.delete_after = new Date(Date.now() + KEEP_DAYS * 24 * 3600 * 1000);
      scheduled++;
    }
    if (Object.keys(set).length) await KycSubmission.updateOne({ _id }, { $set: set });
  } catch (e) {
    failed++;
    console.error('failed ' + String(_id) + ': ' + e.message);
  }
}
console.log('done: ' + moved + ' moved to Cloudinary, ' + scheduled + ' scheduled for deletion in ' + KEEP_DAYS + ' days, ' + failed + ' failed');
await mongoose.disconnect();
