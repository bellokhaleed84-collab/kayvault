import mongoose from 'mongoose';

const purchaseSchema = new mongoose.Schema(
  {
    listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true, unique: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    seller_name: { type: String, default: '' },
    game: String,
    tier: String,
    price: Number,
    platform_fee: { type: Number, default: 0 },
    seller_amount: Number, // what the seller receives after the fee
    payment_reference: { type: String, index: true },
    has_image: { type: Boolean, default: false },
    escrow_status: {
      type: String,
      enum: ['held', 'released', 'refund_requested', 'refunded'],
      default: 'held',
    },
    delivered_at: Date,
    confirm_deadline: Date, // buyer has until this time to confirm or request a refund
    released_at: Date,
    auto_released: { type: Boolean, default: false },
    refund_reason: { type: String, default: '' },
    refund_requested_at: Date,
    first_revealed_at: Date,
    last_revealed_at: Date,
    reveal_count: { type: Number, default: 0 },
    seller_reply: { type: String, default: '', maxlength: 500 },
    seller_replied_at: Date,
    seller_reply_due: Date,
    refund_status: { type: String, enum: ['none', 'submitted', 'failed', 'manual'], default: 'none' },
    refund_reference: { type: String, default: '' },
    refund_error: { type: String, default: '' },
    refunded_at: Date,
    payout_status: { type: String, enum: ['unpaid', 'requested', 'paid'], default: 'unpaid' }, // KV-WD-PURCHASE
    withdrawal: { type: mongoose.Schema.Types.ObjectId, ref: 'Withdrawal', index: true },
    payout_paid_at: Date,
    payout_note: { type: String, default: '' },
    payout_batch: { type: String, default: '', index: true },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.refund_error;
        delete ret.payout_batch;
        return ret;
      },
    },
  }
);

export default mongoose.model('Purchase', purchaseSchema);