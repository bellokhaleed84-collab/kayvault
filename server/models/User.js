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
    terms_accepted_at: { type: Date }, // KV-P17B-MODEL
    phone: { type: String, default: '' }, // KV-PHONE: seller phone, shown to a buyer only through the order contact route
    bank_name: { type: String, default: '' },
    bank_account_number: { type: String, default: '' },
    bank_account_name: { type: String, default: '' },
    bank_changed_at: { type: Date }, // KV-SEC-BANK: set when EXISTING bank details are changed; withdrawals pause for 24 hours
    kyc_status: { type: String, enum: ['none', 'pending', 'verified', 'rejected'], default: 'none' },
    kyc_id_type: { type: String, default: '' },
    kyc_reject_reason: { type: String, default: '', maxlength: 300 },
    reset_token_hash: { type: String, select: false },
    reset_expires: { type: Date, select: false },
    // KV-SEC-VERIFY: only NEW sign-ups are set to true (and only when EMAIL_VERIFY_REQUIRED=true). Old users have no value, so they count as verified.
    email_unverified: { type: Boolean },
    verify_token_hash: { type: String, select: false },
    verify_expires: { type: Date, select: false },
    verify_sent_at: { type: Date, select: false },
    // KV-SEC-SESSION: logins issued before this moment stop working (set when the password is reset)
    password_changed_at: { type: Date },
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
        delete ret.verify_token_hash;
        delete ret.verify_expires;
        delete ret.verify_sent_at;
        delete ret.password_changed_at;
        delete ret.bank_changed_at;
        // The site only treats someone as unverified while the switch is on
        ret.email_unverified = ret.email_unverified === true && process.env.EMAIL_VERIFY_REQUIRED === 'true';
        return ret;
      },
    },
  }
);

export default mongoose.model('User', userSchema);