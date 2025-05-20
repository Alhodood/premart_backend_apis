const mongoose = require('mongoose');

const deliveryBoySchema = new mongoose.Schema(
  {
    name: { type: String, default : "New User" },
    email: { type: String, unique: true, sparse: true },
    phone: { type: String, unique: true, sparse: true },
    password: { type: String },
    countryCode: { type: String, required: true },
    dob: { type: String },
    accountVerify: { type: Boolean, default: false },
    isOnline: { type: Boolean, default: false},
    assignedOrders: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' }],
    role: { 
      type: String, 
      enum: ['deliveryBoy'], 
      default: 'deliveryBoy' 
    },
    emiratesId: String,
    operatingHours: String,
    agencyAddress: String,
    city: String,
    latitude: { type: Number },  // 🌍 Delivery Boy live latitude
    longitude: { type: Number }, // 🌍 Delivery Boy live longitude
    availability: { type: Boolean, default: true }, // 🟢 is available to accept orders
    agencyId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryAgency' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('DeliveryBoy', deliveryBoySchema);