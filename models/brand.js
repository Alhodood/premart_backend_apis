const mongoose = require('mongoose');
const brandSchema = new mongoose.Schema({ brandName: String, brandImage: String },
     { timestamps: true })
module.exports = mongoose.model('Brands', brandSchema);