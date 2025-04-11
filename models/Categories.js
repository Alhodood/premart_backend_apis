const mongoose = require('mongoose');
const categorySchema = new mongoose.Schema({
    categoryName: String,
    categoryImage: String
},
    { timestamps: true })
module.exports = mongoose.model('Category', categorySchema);