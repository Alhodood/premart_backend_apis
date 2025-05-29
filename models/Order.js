const mongoose = require('mongoose');

const deliveryAddressSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String },
  flatNumber: { type: String },
  contact: { type: String, required: true },
  address: { type: String, required: true },
  area: { type: String, required: true },
  place: { type: String, required: true },
  default: { type: Boolean, required: true },
  addressType: { type: String, required: true },
  latitude: Number,
  longitude: Number
}, { _id: false });

const refundRequestSchema = new mongoose.Schema({
  requested: { type: Boolean, default: false },
  reason: { type: String },
  status: { type: String, default: 'Pending' }
}, { _id: false });

const refundDetailsSchema = new mongoose.Schema({
  refundAmount: String,
  refundReason: String
}, { _id: false });

const statusTimestampsSchema = new mongoose.Schema({
  accepted: Date,
  reachedPickup: Date,
  reachedDrop: Date,
  delivered: Date
}, { _id: false });

const orderDetailsSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  productId: [{ type: String, required: true }],
  shopId: { type: String, required: true },

  deliveryAddress: deliveryAddressSchema,

  couponCode: String,
  appliedCoupon: Object,
products: {
  type: [mongoose.Schema.Types.Mixed],
  default: []
},
  totalAmount: { type: String, required: true },
  finalPayable: { type: String, required: true },
  
  deliverycharge: { type: Boolean, required: true },

  deliveryDistance: { type: Number, default: 0 }, // ✅ distance between pickup and drop
  deliveryEarning: { type: Number, default: 0 }, // ✅ earned amount per order

  assignedDeliveryBoy: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryBoy' },
paymentType: { type: String },

  cancelReason: { type: String },
  refundRequest: refundRequestSchema,
  additionalcharges: { type: Number, default: 0 },

  items: { type: Number, default: 0 }, // ✅ number of items in the order (can be auto-calculated from productId.length if needed)

  orderStatus: { type: String, default: "Pending" },
  statusTimestamps: statusTimestampsSchema // ✅ tracking delivery steps

}, { timestamps: true });

module.exports = mongoose.model('Order', orderDetailsSchema);