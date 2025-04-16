const mongoose = require('mongoose');

const Brands = require('../models/Brand');
const Category = require('../models/Categories');
const Model= require('../models/Model');
const Year = require('../models/Year');
const productSchema = new mongoose.Schema({
  name: String,
  type:String,
  brand: { type: mongoose.Schema.Types.ObjectId, ref: Brands },
  category: { type: mongoose.Schema.Types.ObjectId, ref: Category },
  model:{ type: mongoose.Schema.Types.ObjectId, ref: Model } ,
  year:{ type: mongoose.Schema.Types.ObjectId, ref: Year } ,
  color: String,
  price: Number,
  tax: String,
  images: [String],
  description: String,
  partNumber: String,
  partDescription: String,
  otherNote: String,
  position: String,
  condition: String,
  fitmentType: String,
  manufacturer: String,
  sku: String,
  warranty: String
}, { timestamps: true });


module.exports = mongoose.model('Product', productSchema);