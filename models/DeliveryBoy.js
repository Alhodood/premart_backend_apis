const mongoose = require('mongoose');
const { ROLES } = require('../constants/roles');

const deliveryBoySchema = new mongoose.Schema(
  {
    name: { type: String, default : "New User" },
    email: { type: String, unique: true, sparse: true },
    phone: { type: String, unique: true, sparse: true },
    password: { type: String },
    countryCode: { type: String },
    dob: { type: String },
     licenseNo: { type: String },
    accountVerify: { type: Boolean, default: false },
    isOnline: { type: Boolean, default: false},
    assignedOrders: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' }],
        profileImage: { type: String },
    role: {
  type: String,
  enum: Object.values(ROLES),
  default: ROLES.DELIVERY_BOY
},
    areaAssigned: String,
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