const mongoose = require('mongoose');
const fuelSchema = new mongoose.Schema({
    type: String,
  
    visibility:{ type: Boolean, default: true }
},
    { timestamps: true })
module.exports = mongoose.model('Fuel', fuelSchema);