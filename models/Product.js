const mongoose = require('mongoose');

// const Category = require('../models/Categories');
// const Model= require('../models/Model');
// const Year = require('../models/Year');
const productDetailesSchema = new mongoose.Schema({
  name: String,
  type:String,
  brand: String,
  category:String,
  model:String ,
  year:String ,
  // brand: { type: mongoose.Schema.Types.ObjectId, ref: Brands },
  // category: { type: mongoose.Schema.Types.ObjectId, ref: Category },
  // model:{ type: mongoose.Schema.Types.ObjectId, ref: Model } ,
  // year:{ type: mongoose.Schema.Types.ObjectId, ref: Year } ,
  color: String,
  price: Number,
  tax: String,
  picture: [String],
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

const productSchema= new mongoose.Schema({
  shopId: {type:String, required: true },
  products: [productDetailesSchema]
},{timestamps: true });
const Product=mongoose.model('Product',productSchema);
const ProductDetails = mongoose.model('ProductDetails', productDetailesSchema);

module.exports={Product,ProductDetails};