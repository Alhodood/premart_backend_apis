const mongoose = require('mongoose');

const orderDetailsSchema = new mongoose.Schema({
  userId: { type: String, required: true },  // link to user
  productId: [{ type: String, required: true }], 
  shopId: { type: String, required: true },// product ids from cart
  
  deliveryAddress: {
    name: { type: String, required: true },
    email: { type: String, required: true },
    flatNumber: { type: String, required: true },
    contact: { type: String, required: true },
    area: { type: String, required: true },
    place: { type: String, required: true },
    default: { type: Boolean, required: true },
    addressType: { type: String, required: true }
  },
  cancelReason: { type: String },
  refundDetails: {
    refundAmount: { type: String },
    refundReason: { type: String }
  },
  assignedDeliveryBoy: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryBoy' },

  refundRequest: {
    requested: { type: Boolean, default: false },
    reason: { type: String },
    status: { type: String, default: 'Pending' }
  },
  availableCoupon: { type: String },
  offers: { type: String },
  totalAmount: { type: String, required: true },
  discount: { type: String },
  deliverycharge: { type: Boolean, required: true },

  orderStatus: { type: String, default: "Pending" }, // New field (Pending, Confirmed, Shipped, Delivered, Cancelled)

}, { timestamps: true });

module.exports = mongoose.model('Order', orderDetailsSchema);