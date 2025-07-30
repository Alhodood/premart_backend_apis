const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: false }, // Null for SuperAdmin-wide
  userId: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  code: { type: String, unique: true, required: true },
  discountType: { type: String, enum: ['flat', 'percent',"amount"], required: true },
  discountValue: { type: Number, required: true },
  minOrderAmount: Number,
  usageLimit: Number,
  usedCount: { type: Number, default: 0 },
  startDate: Date,
  expiryDate: Date,
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Coupon', couponSchema);