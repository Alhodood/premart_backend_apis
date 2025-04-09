const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: String,
  brand: String,
  category: String,
  color: String,
  year: Number,
  model: String,
  price: Number,
  tax: String,
  images: [String],
  description: String,
  partNumber: String,
  partDescription: String,
  otherNote: String,
  position: String,
  condition: String,
  fitmentType: String,
  manufacturer: String,
  sku: String,
  warranty: String
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);