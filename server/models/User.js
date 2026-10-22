import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password_hash: { type: String, required: true },
    full_name: { type: String, required: true, trim: true },
    country: { type: String, required: true },
    role: { type: String, enum: ['buyer', 'seller'], required: true },
    is_admin: { type: Boolean, default: false },
    suspended: { type: Boolean, default: false },
    notify_email: { type: Boolean, default: true },
    bank_name: { type: String, default: '' },
    bank_account_number: { type: String, default: '' },
    bank_account_name: { type: String, default: '' },
    kyc_status: { type: String, enum: ['none', 'pending', 'verified', 'rejected'], default: 'none' },
    kyc_id_type: { type: String, default: '' },
    kyc_reject_reason: { type: String, default: '', maxlength: 300 },
    reset_token_hash: { type: String, select: false },
    reset_expires: { type: Date, select: false },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.password_hash;
        delete ret.reset_token_hash;
        delete ret.reset_expires;
        return ret;
      },
    },
  }
);

export default mongoose.model('User', userSchema);