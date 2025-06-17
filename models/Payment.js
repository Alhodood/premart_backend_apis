const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop' },
  amount: { type: Number, required: true },
  paymentMethod: { type: String, enum: ['COD', 'Card', 'Wallet', 'UPI'], required: true },
  paymentStatus: { type: String, enum: ['Pending', 'Paid', 'Failed', 'Refunded'], default: 'Pending' },
  transactionId: { type: String }, // External payment gateway ID
  paymentDate: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);