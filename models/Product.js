const mongoose = require('mongoose');

const productDetailesSchema = new mongoose.Schema({
  name: String,
  type: String,
  brand: String,     // Reference by name
  category: String,  // Reference by name
  model: String,     // Reference by name
  year: String,      // Reference by value
  fuelType: String,  // New field

  
  variants: [
    {
      color: String,
      stock: Number,
      price: Number,
      discountedPrice: Number,
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
      warranty: String,
      thresholdQuantity: Number
    }
  ],

}, { timestamps: true });

const productSchema = new mongoose.Schema({
  shopId: { type: String, required: true },
  products: [productDetailesSchema]
}, { timestamps: true });

const Product = mongoose.model('Product', productSchema);
const ProductDetails = mongoose.model('ProductDetails', productDetailesSchema);

module.exports = { Product, ProductDetails };