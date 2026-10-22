// KV-KYCSWEEP v1
import KycSubmission from '../models/KycSubmission.js';
import { destroyPrivate } from './kycStore.js';

// Deletes reviewed KYC submissions (Cloudinary photos first, then the record) once their keep-until date has passed.
export async function sweepKyc() {
  const rows = await KycSubmission.find({ delete_after: { $lte: new Date() } }).select('id_image.cloud_id selfie.cloud_id').limit(50);
  let n = 0;
  for (const s of rows) {
    try {
      for (const img of [s.id_image, s.selfie]) {
        if (img && img.cloud_id) await destroyPrivate(img);
      }
      await KycSubmission.deleteOne({ _id: s._id });
      n++;
    } catch (e) {
      console.error('[kyc] could not delete submission', String(s._id), e.message);
    }
  }
  return n;
}
