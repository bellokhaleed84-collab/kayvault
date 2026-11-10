import mongoose from 'mongoose';

// One row per game top-up. Created when the buyer starts checkout, then moved forward as
// Paystack confirms the payment and the provider (Eyad or GamesDrop) delivers the coins.
const topupSchema = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true }, // Paystack reference and provider transaction id
    provider: { type: String, enum: ['gamesdrop', 'eyad'], default: 'gamesdrop' },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    offer_id: { type: Number, default: 0 }, // GamesDrop only
    game_id: { type: String, default: '' }, // Eyad only
    package_id: { type: String, default: '' }, // Eyad only
    product_name: { type: String, default: '' },
    offer_name: { type: String, default: '' },
    game_user_id: { type: String, default: '' },
    game_server_id: { type: String, default: '' },
    zone_id: { type: String, default: '' },
    player_name: { type: String, default: '' },
    usd_price: { type: Number, default: 0 },   // provider price when checkout started
    rate: { type: Number, default: 0 },        // Naira per dollar used for this order
    markup_percent: { type: Number, default: 0 },
    naira_amount: { type: Number, required: true },
    amount_kobo: { type: Number, required: true }, // what Paystack must report
    max_charge_usd: { type: Number, default: 0 },  // Eyad price cap: never pay more than the buyer paid
    status: {
      type: String,
      enum: ['pending', 'paid', 'processing', 'completed', 'failed', 'refund_needed', 'refunding', 'refunded', 'refund_failed', 'check_needed', 'error'],
      default: 'pending',
      index: true,
    },
    fail_reason: { type: String, default: '' },
    gd_order_id: { type: Number },
    gd_status: { type: String, default: '' },
    gd_price: { type: Number, default: 0 },
    gd_error: { type: String, default: '' },
    eyad_ref: { type: String, default: '' },     // the payment_reference sent to Eyad
    eyad_sent: { type: Boolean, default: false }, // true once a send with eyad_ref may have reached Eyad
    eyad_order_id: { type: String, default: '' },
    eyad_status: { type: String, default: '' },
    eyad_charged: { type: Number, default: 0 },
    paystack_id: { type: String, default: '' },
    paid_at: Date,
    completed_at: Date,
    placing_at: Date,
    attempts: { type: Number, default: 0 },
    last_polled_at: Date,
    admin_flagged: { type: Boolean, default: false },
    refund_reference: { type: String, default: '' },
    refund_error: { type: String, default: '' },
    refunded_at: Date,
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: {
      // What the buyer's browser may see. Internal fields stay on the server.
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.buyer;
        delete ret.usd_price;
        delete ret.rate;
        delete ret.markup_percent;
        delete ret.amount_kobo;
        delete ret.max_charge_usd;
        delete ret.package_id;
        delete ret.gd_order_id;
        delete ret.gd_price;
        delete ret.gd_error;
        delete ret.eyad_ref;
        delete ret.eyad_sent;
        delete ret.eyad_order_id;
        delete ret.eyad_status;
        delete ret.eyad_charged;
        delete ret.paystack_id;
        delete ret.placing_at;
        delete ret.attempts;
        delete ret.last_polled_at;
        delete ret.admin_flagged;
        delete ret.refund_reference;
        delete ret.refund_error;
        return ret;
      },
    },
  }
);

topupSchema.index({ status: 1, created_at: 1 });

export default mongoose.model('TopupOrder', topupSchema);