const mongoose = require('mongoose');

const superNotificationSchema = new mongoose.Schema({
  title: { type: String, required: true },
  message: { type: String, required: true },

  recipientIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // optional: multi-target
  role: { type: String, enum: ['customer', 'shopAdmin', 'superAdmin', 'deliveryBoy', 'all'], default: 'all' },

  type: { type: String, enum: ['info', 'alert', 'order', 'promo'], default: 'info' },

  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // track who read it
  isScheduled: { type: Boolean, default: false },
  scheduledAt: { type: Date }, // future use

  sentAt: { type: Date },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' } // Admin who created

}, { timestamps: true });

module.exports = mongoose.model('SuperNotification', superNotificationSchema);