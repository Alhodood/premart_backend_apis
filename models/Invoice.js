const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  items: [
    {
      partNumber: String,
      partName: String,
      quantity: Number,
      price: Number,
      discountedPrice: Number,
      total: Number
    }
  ],
  subTotal: { type: Number, required: true },
  deliveryCharge: { type: Number, required: true },
  totalAmount: { type: Number,  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Invoice', invoiceSchema);