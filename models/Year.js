const mongoose = require('mongoose');
const yearsSchema = new mongoose.Schema({
    year: String,
  
    visibility:{ type: Boolean, default: true }
},
    { timestamps: true })
module.exports = mongoose.model('Year', yearsSchema);