// models/ProductRating.js
const mongoose = require('mongoose');

const productRatingSchema = new mongoose.Schema({
  // The user who is rating
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // The shop where the product was purchased
  shopId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shop',
    required: true
  },

  // The shop product being rated (links product + shop)
  shopProductId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ShopProduct',
    required: true
  },

  // The order that proves purchase and delivery
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },

  // Rating (1-5 stars)
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },

  // Comment/Review text
  comment: {
    type: String,
    maxlength: 1000
  },

  // Optional images for the review
  images: [{ type: String }],

  // For moderation purposes
  isVisible: {
    type: Boolean,
    default: true
  }

}, { timestamps: true });

// Ensure one user can only rate a product from a specific shop once per order
productRatingSchema.index({ userId: 1, shopProductId: 1, orderId: 1 }, { unique: true });

// Index for fetching ratings by shop product
productRatingSchema.index({ shopProductId: 1, isVisible: 1 });

// Index for fetching ratings by shop
productRatingSchema.index({ shopId: 1, isVisible: 1 });

// Index for fetching user's ratings
productRatingSchema.index({ userId: 1 });

module.exports = mongoose.model('ProductRating', productRatingSchema);
