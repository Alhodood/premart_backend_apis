const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
  shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: false },
  title: { type: String, required: true },
  description: String,
  discountType: { type: String, enum: ['amount', 'percent'], required: true },
  discountValue: { type: Number, required: true },
  productIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  startDate: Date,
  endDate: Date,
  isActive: { type: Boolean, default: true },
   usedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

module.exports = mongoose.model('Offers', offerSchema);