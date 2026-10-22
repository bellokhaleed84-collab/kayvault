import mongoose from 'mongoose';

const imageSchema = new mongoose.Schema(
  { data: { type: Buffer }, mime: { type: String, required: true }, cloud_id: { type: String }, cloud_format: { type: String } },
  { _id: false }
);

// One submission per seller. Images are only ever sent to admins.
const kycSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    id_type: { type: String, enum: ['nin', 'drivers_licence', 'passport'], required: true },
    id_image: { type: imageSchema, required: true },
    selfie: { type: imageSchema, required: true },
    delete_after: { type: Date },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

export default mongoose.model('KycSubmission', kycSchema);