const mongoose = require('mongoose');
const categorySchema = new mongoose.Schema({
    categoryName: String,
    categoryImage: String
    
    , 
    visibility:{ type: Boolean, default: true }
},
    { timestamps: true });
module.exports = mongoose.model('Category', categorySchema);