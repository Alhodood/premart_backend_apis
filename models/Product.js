const mongoose = require('mongoose');

const productDetailesSchema = new mongoose.Schema({
  name: String,
  type: String,
  brand: String,
  category: String,
  model: String,
  year: String,
  subCategories: [{
    name: String,
    Images: [String],
    availablePartNumber: [String]
 }],
  color: String,
  price: Number,
  discountedPrice: Number,
  quantity: Number,
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
  warranty: String,
  useToAnotherVehichle: String,
  shopId: String,
  selectedCartForMobile: { type: Boolean, default: false },
  stockStatus: {
    type: String,
    enum: ['in_stock', 'out_of_stock', 'low_stock'],
    default: 'in_stock'
  },
  ratings: {
    average: { type: Number, default: 0 },
    totalReviews: { type: Number, default: 0 }
  },
  comments: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    username: String,
    comment: String,
    createdAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

const productSchema = new mongoose.Schema({
  shopId: { type: String, required: true },
  products: [productDetailesSchema]
}, { timestamps: true });

const Product = mongoose.model('Product', productSchema);
module.exports = { Product };