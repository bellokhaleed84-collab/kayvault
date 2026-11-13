// KV-SUPPORT v1: a support chat between one user and the admin
import mongoose from 'mongoose';

const msg = new mongoose.Schema({
  from: { type: String, enum: ['user', 'admin'], required: true },
  body: { type: String, required: true, maxlength: 1000 },
  created_at: { type: Date, default: Date.now },
});

const schema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['open', 'closed'], default: 'open' },
    messages: [msg],
    user_unread: { type: Number, default: 0 },
    admin_unread: { type: Number, default: 0 },
    last_message_at: { type: Date, default: Date.now },
    closed_at: { type: Date },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

// A user can only have one open chat at a time
schema.index({ user: 1 }, { unique: true, partialFilterExpression: { status: 'open' } });
schema.index({ status: 1, last_message_at: -1 });
// Closed chats clean themselves up after 120 days
schema.index({ closed_at: 1 }, { expireAfterSeconds: 120 * 24 * 3600 });

export default mongoose.model('SupportTicket', schema);