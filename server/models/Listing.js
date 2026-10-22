import mongoose from 'mongoose';

const imageSchema = new mongoose.Schema(
  { data: { type: Buffer }, mime: { type: String, required: true }, cloud_id: { type: String }, cloud_type: { type: String }, cloud_url: { type: String } },
  { _id: false }
);

const listingSchema = new mongoose.Schema(
  {
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    seller_name: { type: String, default: '' },
    game: { type: String, required: true, trim: true, maxlength: 80, index: true },
    tier: { type: String, required: true, trim: true, maxlength: 200 },
    level: { type: String, default: '', maxlength: 60 },
    platform: { type: String, enum: ['PC', 'PlayStation', 'Xbox', 'Mobile', 'Other'], default: 'Other' },
    account_type: { type: String, enum: ['standard', 'modded', 'smurf', 'fresh', 'other'], default: 'standard' },
    description: { type: String, default: '', maxlength: 2000 },
    features: { type: [String], default: [] },
    images: { type: [imageSchema], default: [] },
    price: { type: Number, required: true, min: 1 },
    credentials_enc: { type: String, select: false }, // AES-256-GCM login details. Never sent to clients.
    status: { type: String, enum: ['pending', 'live', 'sold'], default: 'pending', index: true },
    reserved_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reserved_until: { type: Date, default: null },
    seller_suspended: { type: Boolean, default: false },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: {
      // Also runs for the image subdocuments, which have no _id: leave those alone.
      transform(_doc, ret) {
        if (!ret._id) return ret;
        ret.id = ret._id.toString();
        ret.image_urls = (ret.images || []).map((_, i) => `/api/listings/${ret.id}/image/${i}`);
        delete ret.images;
        delete ret.credentials_enc;
        delete ret.reserved_by;
        delete ret.reserved_until;
        delete ret.seller_suspended;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

export default mongoose.model('Listing', listingSchema);