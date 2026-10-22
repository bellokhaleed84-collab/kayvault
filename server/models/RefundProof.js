import mongoose from 'mongoose';

// A screenshot or screen recording a buyer attaches to a refund request.
// The file itself is stored in MongoDB and never included in normal responses.
const proofSchema = new mongoose.Schema(
  {
    purchase: { type: mongoose.Schema.Types.ObjectId, ref: 'Purchase', required: true, index: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, default: 'proof', maxlength: 100 },
    role: { type: String, enum: ['buyer', 'seller'], default: 'buyer' }, // KV-PROOF-ROLE: who uploaded the file
    mime: { type: String, required: true },
    size: { type: Number, required: true },
    data: { type: Buffer, select: false }, // only for proofs stored in MongoDB (older ones, or when Cloudinary is not set up)
    cloud_id: { type: String },
    cloud_type: { type: String },
    cloud_url: { type: String },
    delete_after: { type: Date },
    // Set when the refund request is resolved: MongoDB deletes the file after this time
    expires_at: { type: Date },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.data;
        delete ret.buyer;
        delete ret.purchase;
        delete ret.expires_at;
        delete ret.cloud_id;
        delete ret.cloud_type;
        delete ret.cloud_url;
        delete ret.delete_after;
        return ret;
      },
    },
  }
);

proofSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('RefundProof', proofSchema);