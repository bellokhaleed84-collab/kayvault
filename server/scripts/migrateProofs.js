// KV-MIGRATEPROOFS v1
import 'dotenv/config';
import dns from 'node:dns';
import mongoose from 'mongoose';
import RefundProof from '../models/RefundProof.js';
import { cloudConfigured, uploadBuffer } from '../lib/cloudinary.js';

dns.setServers(['8.8.8.8', '1.1.1.1']);
if (!cloudConfigured() || !process.env.MONGODB_URI) {
  console.error('Set the CLOUDINARY_* variables and MONGODB_URI in server/.env first.');
  process.exit(1);
}

await mongoose.connect(process.env.MONGODB_URI);
const ids = await RefundProof.find({ cloud_id: { $exists: false } }).select('_id');
console.log(ids.length + ' proof(s) to move');
let ok = 0;
let failed = 0;
for (const { _id } of ids) {
  try {
    const doc = await RefundProof.findById(_id).select('+data');
    if (!doc || !doc.data || doc.cloud_id) continue;
    const up = await uploadBuffer(doc.data, doc.mime.startsWith('video/') ? 'video' : 'image', 'kayvault/proofs', doc.mime);
    const set = { cloud_id: up.public_id, cloud_type: up.resource_type, cloud_url: up.secure_url };
    if (doc.expires_at) set.delete_after = doc.expires_at;
    await RefundProof.updateOne({ _id, cloud_id: { $exists: false } }, { $set: set, $unset: { data: 1, expires_at: 1 } });
    ok++;
    console.log('moved ' + String(_id));
  } catch (e) {
    failed++;
    console.error('failed ' + String(_id) + ': ' + e.message);
  }
}
console.log('done: ' + ok + ' moved, ' + failed + ' failed (failed ones stay in MongoDB, run again to retry)');
await mongoose.disconnect();
