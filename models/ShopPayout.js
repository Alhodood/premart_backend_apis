const mongoose = require('mongoose');

const shopPayoutSchema = new mongoose.Schema({
  shopId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Shop', 
    required: true 
  },
  totalOrders: { 
    type: Number, 
    required: true 
  },
  totalSales: { 
    type: Number, 
    required: true 
  },
  platformCommission: { 
    type: Number, 
    required: true 
  },
  netPayable: { 
    type: Number, 
    required: true 
  },
  status: { 
    type: String, 
    enum: ['Pending', 'Processing', 'Paid', 'Failed'], 
    default: 'Pending' 
  },
  from: { 
    type: Date, 
    required: true 
  },
  to: { 
    type: Date, 
    required: true 
  },
  transactionId: String,
  paymentMethod: { 
    type: String, 
    enum: ['Bank Transfer', 'Cash', 'Check', 'Other'], 
    default: 'Bank Transfer' 
  },
  paidAt: Date,
  notes: String
}, { timestamps: true });

module.exports = mongoose.model('ShopPayout', shopPayoutSchema);