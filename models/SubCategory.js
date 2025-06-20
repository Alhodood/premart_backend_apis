const mongoose = require('mongoose');

const subCategorySchema = new mongoose.Schema({
  subCategoryName: { type: String, required: true },
  subCategoryImage: { type: String },
  // Reference to parent Category
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  visibility: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('SubCategory', subCategorySchema);