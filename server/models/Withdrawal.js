// KV-WITHDRAWAL v1
import mongoose from 'mongoose';

// One withdrawal request from a seller. The orders it pays are marked on the Purchase
// (payout_status 'requested', then 'paid'). If it fails they go back to 'unpaid'.
const schema = new mongoose.Schema(
  {
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true, min: 1 }, // Naira
    order_ids: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    order_count: { type: Number, default: 0 },
    bank_name: { type: String, default: '' },
    bank_account_number: { type: String, default: '' },
    bank_account_name: { type: String, default: '' },
    reference: { type: String, required: true, unique: true },
    status: { type: String, enum: ['pending', 'processing', 'paid', 'failed'], default: 'pending', index: true },
    mode: { type: String, enum: ['auto', 'manual'], default: 'manual' },
    recipient_code: { type: String, default: '' },
    transfer_code: { type: String, default: '' },
    error: { type: String, default: '', maxlength: 300 }, // for admins only
    note: { type: String, default: '', maxlength: 300 },  // shown to the seller
    paid_at: Date,
    done: { type: Boolean, default: false }, // true once the orders were updated to match the result
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

export default mongoose.model('Withdrawal', schema);