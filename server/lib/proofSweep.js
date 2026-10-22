// KV-PROOFSWEEP v1
import RefundProof from '../models/RefundProof.js';
import { cloudConfigured, destroyAsset } from './cloudinary.js';

// Deletes proofs that live on Cloudinary once their keep-until date has passed (MongoDB's own TTL cannot reach Cloudinary).
export async function sweepProofs() {
  if (!cloudConfigured()) return 0;
  const rows = await RefundProof.find({ cloud_id: { $exists: true }, delete_after: { $lte: new Date() } }).limit(50);
  let n = 0;
  for (const p of rows) {
    try {
      await destroyAsset(p);
      await RefundProof.deleteOne({ _id: p._id });
      n++;
    } catch (e) {
      console.error('[cloudinary] could not delete proof', String(p._id), e.message);
    }
  }
  return n;
}
