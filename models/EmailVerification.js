const mongoose = require('mongoose');

const OTP_EXPIRY_MINUTES = 15;

const emailVerificationSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true, trim: true, index: true },
  otp: { type: String, required: true },
  expiresAt: { type: Date, required: true }
}, { timestamps: true });

// TTL index: MongoDB removes expired docs. Do not add index: true on expiresAt (duplicate).
emailVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('EmailVerification', emailVerificationSchema);
module.exports.OTP_EXPIRY_MINUTES = OTP_EXPIRY_MINUTES;
