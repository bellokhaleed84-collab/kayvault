// KV-EYAD v1
import mongoose from 'mongoose';

// Small key/value store for settings you change from the admin page.
const settingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

export default mongoose.model('Setting', settingSchema);