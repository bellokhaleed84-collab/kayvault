// KV-AUDIT v1
import mongoose from 'mongoose';

// A permanent record of sensitive admin actions (who did what, when, on which order).
// It never stores the sensitive data itself.
const schema = new mongoose.Schema(
  {
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    admin_name: { type: String, default: '' },
    action: { type: String, required: true },
    purchase: { type: mongoose.Schema.Types.ObjectId, ref: 'Purchase', index: true },
    listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing' },
    ip: { type: String, default: '' },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

schema.index({ purchase: 1, created_at: -1 });

export default mongoose.model('AuditLog', schema);
