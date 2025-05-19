const mongoose = require('mongoose');

const stockSchema = new mongoose.Schema({
  shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  // productId refers to a subdocument in the 'products' array within the 'Product' collection
  productId: { type: mongoose.Schema.Types.ObjectId, required: true },

  quantity: { type: Number, required: true },
  threshold: { type: Number, default: 5 }, // for low stock alert
  lastRestockedAt: { type: Date },

}, { timestamps: true });

stockSchema.index({ shopId: 1, productId: 1 }, { unique: true });

module.exports = mongoose.model('Stock', stockSchema);