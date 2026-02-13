// models/MasterOrder.js
const mongoose = require('mongoose');

const masterOrderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  orderIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' }], // ✅ This will store order IDs
  totalAmount: { type: Number, required: true },
  finalPayable: { type: Number, required: true }, // ✅ Changed to Number
  deliverycharge: { type: Number, required: true, default: 0 },
  couponApplied: {
    code: String,
    discountType: String,
    discountValue: Number,
    discountAmount: Number
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('MasterOrder', masterOrderSchema);