const mongoose = require('mongoose');

const engineSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },        // 1GR-FE
  displacement: { type: String },                              // 4.0L
  fuelType: { type: String },                                  // Petrol, Diesel, Hybrid
  cylinders: { type: Number },                                 // 4, 6, 8

  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Engine', engineSchema);