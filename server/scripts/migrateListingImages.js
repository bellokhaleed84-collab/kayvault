// KV-MIGRATELISTINGS v1
import 'dotenv/config';
import dns from 'node:dns';
import mongoose from 'mongoose';
import Listing from '../models/Listing.js';
import { cloudConfigured, uploadBuffer, destroyAsset } from '../lib/cloudinary.js';

dns.setServers(['8.8.8.8', '1.1.1.1']);
if (!cloudConfigured() || !process.env.MONGODB_URI) {
  console.error('Set the CLOUDINARY_* variables and MONGODB_URI in server/.env first.');
  process.exit(1);
}

await mongoose.connect(process.env.MONGODB_URI);
const ids = await Listing.find({ 'images.0': { $exists: true }, 'images.cloud_id': { $exists: false } }).select('_id');
console.log(ids.length + ' listing(s) to move');
let ok = 0;
let failed = 0;
for (const { _id } of ids) {
  const uploaded = [];
  try {
    const l = await Listing.findById(_id);
    if (!l) continue;
    const out = [];
    for (const img of l.images) {
      if (img.cloud_id || !img.data) { out.push(img.toObject()); continue; }
      const up = await uploadBuffer(img.data, 'image', 'kayvault/listings', img.mime);
      const rec = { mime: img.mime, cloud_id: up.public_id, cloud_type: up.resource_type, cloud_url: up.secure_url };
      uploaded.push(rec);
      out.push(rec);
    }
    await Listing.updateOne({ _id }, { $set: { images: out } });
    ok++;
    console.log('moved ' + String(_id));
  } catch (e) {
    failed++;
    for (const d of uploaded) await destroyAsset(d).catch(() => {});
    console.error('failed ' + String(_id) + ': ' + e.message);
  }
}
console.log('done: ' + ok + ' moved, ' + failed + ' failed (failed ones stay in MongoDB, run again to retry)');
await mongoose.disconnect();
