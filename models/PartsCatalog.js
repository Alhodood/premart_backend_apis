// models/PartsCatalog.js
const mongoose = require('mongoose');

const partsCatalogSchema = new mongoose.Schema({
  partNumber: { type: String, required: true, index: true },
  partName: { type: String, required: true },
  description: String,

  brand: { type: mongoose.Schema.Types.ObjectId, ref: 'Brand', required: true },
  model: { type: mongoose.Schema.Types.ObjectId, ref: 'Model', required: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },

  yearFrom: Number,
  yearTo: Number,

engine: { type: mongoose.Schema.Types.ObjectId, ref: 'Engine' },
transmission: { type: mongoose.Schema.Types.ObjectId, ref: 'Transmission' },

  images: [String],
isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('PartsCatalog', partsCatalogSchema);