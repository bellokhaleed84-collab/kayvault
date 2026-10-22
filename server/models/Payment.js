import mongoose from 'mongoose';

// One row per Paystack checkout. The order (Purchase) is only created after this is verified.
const paymentSchema = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true },
    listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true, index: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    game: { type: String, default: '' },
    amount: { type: Number, required: true },       // Naira
    amount_kobo: { type: Number, required: true },  // what Paystack must report
    fee: { type: Number, required: true },          // KayVault platform fee, Naira
    seller_amount: { type: Number, required: true },// amount minus fee, Naira
    status: {
      type: String,
      enum: ['pending', 'processing', 'paid', 'failed', 'error', 'refund_needed', 'refunding', 'refunded'],
      default: 'pending',
    },
    purchase: { type: mongoose.Schema.Types.ObjectId, ref: 'Purchase' },
    paystack_id: { type: String, default: '' },
    paid_at: Date,
    refund_reference: { type: String, default: '' },
    refund_error: { type: String, default: '' },
    refunded_at: Date,
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

export default mongoose.model('Payment', paymentSchema);