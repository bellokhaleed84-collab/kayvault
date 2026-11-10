// KV-ORDERCHAT v1
import mongoose from 'mongoose';

// One message in the chat between the buyer and the seller of an order (for example a login code the seller sends).
const schema = new mongoose.Schema(
  {
    purchase: { type: mongoose.Schema.Types.ObjectId, ref: 'Purchase', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    from: { type: String, enum: ['buyer', 'seller'], required: true },
    body: { type: String, required: true, maxlength: 1000 },
    read: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

schema.index({ purchase: 1, created_at: 1 });
schema.index({ purchase: 1, read: 1 });
// Messages clean themselves up after 120 days
schema.index({ created_at: 1 }, { expireAfterSeconds: 120 * 24 * 3600 });

export default mongoose.model('OrderMessage', schema);