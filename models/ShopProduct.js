// models/ShopProduct.js
const mongoose = require('mongoose');

const shopProductSchema = new mongoose.Schema({
  shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  part: { type: mongoose.Schema.Types.ObjectId, ref: 'PartsCatalog', required: true },

  price: { type: Number, required: true },
  discountedPrice: Number,

  stock: { type: Number, default: 0 },
  isAvailable: { type: Boolean, default: true },

}, { timestamps: true });

// Indexes for performance optimization
shopProductSchema.index({ part: 1, isAvailable: 1 });
shopProductSchema.index({ shopId: 1, isAvailable: 1 });
shopProductSchema.index({ part: 1, shopId: 1, isAvailable: 1 }); // Compound index
shopProductSchema.index({ price: 1 }); // For price sorting

module.exports = mongoose.model('ShopProduct', shopProductSchema);