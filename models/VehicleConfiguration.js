const mongoose = require('mongoose');

const vehicleConfigurationSchema = new mongoose.Schema({
  brand: { type: mongoose.Schema.Types.ObjectId, ref: 'Brand', required: true },
  model: { type: mongoose.Schema.Types.ObjectId, ref: 'Model', required: true },

  yearFrom: { type: Number, required: true },
  yearTo: { type: Number, required: true },

  engineType: { type: mongoose.Schema.Types.ObjectId, ref: 'Engine' },
  transmission: { type: mongoose.Schema.Types.ObjectId, ref: 'Transmission' },

  frameCode: String,
  region: String,
  trim: String,
  commonName: String,

  vinPatterns: [String],
  description: String,

  visibility: { type: Boolean, default: true },
  isActive: { type: Boolean, default: true }

}, { timestamps: true });

module.exports = mongoose.model('VehicleConfiguration', vehicleConfigurationSchema);