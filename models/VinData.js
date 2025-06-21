const mongoose = require("mongoose");

const vinDataDetailsSchema = new mongoose.Schema({
  brand: String,
  model: String,
  year: String,
  country: String
}, { timestamps: true });

const vinEntrySchema = new mongoose.Schema({
  vinKey: { type: String, required: true },
  data: vinDataDetailsSchema
}, { timestamps: true });

// const vinDataSchema = new mongoose.Schema({
//   vinList: [vinEntrySchema]
// }, { timestamps: true });

const VinData = mongoose.model("VinData", vinEntrySchema);
module.exports ={VinData};