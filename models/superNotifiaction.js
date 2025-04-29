const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  title: { type: String, required: true },              // Title for admin reference
  message: { type: String, required: true },             // SMS body
  recipients: [{ type: String, required: true }],        // Array of phone numbers
  sendNow: { type: Boolean, default: true },             // Send immediately or schedule
  scheduledAt: { type: Date },                           // Scheduled time for future sends
  sentAt: { type: Date },                                // When SMS was actually sent
  status: { type: String, enum: ['Pending', 'Sent', 'Failed'], default: 'Pending' }, // State of sending
  failureReason: { type: String },                       // If failed, store why
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);