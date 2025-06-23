const mongoose = require('mongoose');

const catalogImageSchema = new mongoose.Schema({
  images: {
    type: [String], // Array of image URLs
    required: true
  },
  brand: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Brand',
    required: true
  },
  model: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Model',
    required: true
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  subCategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubCategory',
    required: true
  },
  visibility: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

module.exports = mongoose.model('CatalogImage', catalogImageSchema);