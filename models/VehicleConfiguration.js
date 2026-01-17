// models/VehicleConfiguration.js
const mongoose = require('mongoose');

const vehicleConfigurationSchema = new mongoose.Schema({
  brand: { type: mongoose.Schema.Types.ObjectId, ref: 'Brand', required: true },
  model: { type: mongoose.Schema.Types.ObjectId, ref: 'Model', required: true },

  year: { type: Number, required: true },

  engineType: { type: String },        // e.g. "1.8L Petrol", "2.0 Diesel"
  transmission: { type: String },      // e.g. "Automatic", "Manual"

  frameCode: String,
  region: String,

  trim: [String],                     // e.g. ["Base", "Sport", "Limited"]
  commonName: String,

  vinPatterns: [String],
  description: String,

  visibility: { type: Boolean, default: true },
  isActive: { type: Boolean, default: true }

}, { timestamps: true });

/*  Add this HERE */
vehicleConfigurationSchema.index(
  { brand: 1, model: 1, year: 1, engineType: 1, transmission: 1 },
  { unique: true }
);

module.exports = mongoose.model('VehicleConfiguration', vehicleConfigurationSchema);