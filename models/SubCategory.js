const mongoose = require('mongoose');

const subCategorySchema = new mongoose.Schema({
  subCategoryName: { type: String, required: true },
  subCategoryImage: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('SubCategory', subCategorySchema);