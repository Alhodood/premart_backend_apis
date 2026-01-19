const mongoose = require('mongoose');

const partsCatalogSchema = new mongoose.Schema({
  partNumber: { type: String, required: true, index: true },
  partName: { type: String, required: true },
  description: String,

  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  subCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'SubCategory', required: true },

  compatibleVehicleConfigs: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VehicleConfiguration'
  }],

  madeIn: String,
  weight: Number,

  dimensions: {
    length: Number,
    width: Number,
    height: Number
  },

  oemNumber: String,
  warranty: String,

  images: [String],
  isActive: { type: Boolean, default: true }

}, { timestamps: true });

module.exports = mongoose.model('PartsCatalog', partsCatalogSchema);