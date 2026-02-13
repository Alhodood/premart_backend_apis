// models/Payment.js
const mongoose = require('mongoose');

const deliveryAddressSchema = new mongoose.Schema({
  name: { type: String },
  contact: { type: String },
  address: { type: String },
  area: { type: String },
  place: { type: String },
  latitude: { type: Number },
  longitude: { type: Number },
  addressType: { type: String, default: 'Home' }
}, { _id: false });

const couponDetailsSchema = new mongoose.Schema({
  code: { type: String },
  discountType: { type: String },
  discountValue: { type: Number },
  discountAmount: { type: Number }
}, { _id: false });

const paymentSchema = new mongoose.Schema({
  orderId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'MasterOrder',
    required: true 
  },
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  shopId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Shop' 
  },
  amount: { type: Number, required: true },
  paymentMethod: { 
    type: String, 
    enum: ['COD', 'CARD', 'WALLET', 'UPI'], 
    required: true 
  },
  paymentStatus: { 
    type: String, 
    enum: ['Pending', 'Paid', 'Failed', 'Refunded'], 
    default: 'Pending' 
  },
  transactionId: { 
    type: String, 
    required: true,
    unique: true 
  },
  
  // ✅ NEW FIELDS
  deliveryAddress: { 
    type: deliveryAddressSchema,
    required: true 
  },
  couponCode: { 
    type: String,
    default: null 
  },
  couponDetails: { 
    type: couponDetailsSchema,
    default: null 
  },
  
  paymentDate: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);