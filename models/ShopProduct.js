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

module.exports = mongoose.model('ShopProduct', shopProductSchema);