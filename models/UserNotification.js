const mongoose = require('mongoose');

const userNotificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    body: { type: String, default: '' },
    type: { type: String, enum: ['order', 'order_status', 'promo', 'info', 'alert'], default: 'info' },
    data: {
      orderId: String,
      route: String,
      shopId: String,
      extra: mongoose.Schema.Types.Mixed
    },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

userNotificationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('UserNotification', userNotificationSchema);
