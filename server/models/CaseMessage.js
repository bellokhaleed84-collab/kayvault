// KV-CASEMSG v1
import mongoose from 'mongoose';

// One message inside a private support thread (admin <-> buyer, or admin <-> seller) for an order.
const schema = new mongoose.Schema(
  {
    purchase: { type: mongoose.Schema.Types.ObjectId, ref: 'Purchase', required: true },
    thread: { type: String, enum: ['buyer', 'seller'], required: true },
    from_admin: { type: Boolean, default: false },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, maxlength: 1000 },
    flag: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

schema.index({ purchase: 1, thread: 1, created_at: 1 });
// Messages clean themselves up after 120 days
schema.index({ created_at: 1 }, { expireAfterSeconds: 120 * 24 * 3600 });

export default mongoose.model('CaseMessage', schema);
