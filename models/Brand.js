const mongoose = require('mongoose');
const brandSchema = new mongoose.Schema({
    brandName: String, brandImage: String,
    
    visibility: { type: Boolean, default: true }},
    { timestamps: true });
module.exports = mongoose.model('Brand', brandSchema);