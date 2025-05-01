const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: false }, // Null for SuperAdmin-wide
  code: { type: String, unique: true, required: true },
  discountType: { type: String, enum: ['flat', 'percent'], required: true },
  discountValue: { type: Number, required: true },
  minOrderAmount: Number,
  usageLimit: Number,
  usedCount: { type: Number, default: 0 },
  expiryDate: Date,
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Coupon', couponSchema);