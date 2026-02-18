const mongoose = require('mongoose');

const deviceTokenSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    device_id: { type: String, required: true },
    device_token: { type: String, required: true },
    updated_at: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

deviceTokenSchema.index({ device_id: 1 }, { unique: true });
deviceTokenSchema.index({ user_id: 1 });

module.exports = mongoose.model('DeviceToken', deviceTokenSchema);
