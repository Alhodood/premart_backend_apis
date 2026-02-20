// models/SuperNotification.js - Enhanced version
const mongoose = require('mongoose');

const superNotificationSchema = new mongoose.Schema({
  title: { type: String, required: true },
  message: { type: String, required: true },
  recipientIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  role: { 
    type: String, 
    enum: ['customer', 'shopAdmin', 'superAdmin', 'deliveryBoy', 'agency', 'all'], 
    default: 'all' 
  },
  type: { 
    type: String, 
    enum: ['info', 'alert', 'order', 'promo', 'payment', 'verification'], 
    default: 'info' 
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  isScheduled: { type: Boolean, default: false },
  scheduledAt: { type: Date },
  sentAt: { type: Date },
  targetId: { type: mongoose.Schema.Types.ObjectId, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Index for faster queries
superNotificationSchema.index({ role: 1, createdAt: -1 });
superNotificationSchema.index({ recipientIds: 1, createdAt: -1 });
superNotificationSchema.index({ readBy: 1 });

module.exports = mongoose.model('SuperNotification', superNotificationSchema);