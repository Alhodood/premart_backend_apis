const mongoose = require('mongoose');

const masterInvoiceSchema = new mongoose.Schema({
  
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  orderIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' }],
  totalAmount: { type: Number, required: true },
  finalPayable: { type: String, required: true },
  couponApplied: {
    code: String,
    discountType: String,
    discountValue: Number,
    discountAmount: Number
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('MasterOrder', masterInvoiceSchema);