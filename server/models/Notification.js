import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['order', 'listing', 'review', 'info'], default: 'info' },
    title: { type: String, required: true, maxlength: 120 },
    body: { type: String, default: '', maxlength: 300 },
    link: { type: String, default: '', maxlength: 200 },
    read: { type: Boolean, default: false },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.user;
        return ret;
      },
    },
  }
);

// Old notifications clean themselves up after 60 days
notificationSchema.index({ created_at: 1 }, { expireAfterSeconds: 60 * 24 * 3600 });

export default mongoose.model('Notification', notificationSchema);