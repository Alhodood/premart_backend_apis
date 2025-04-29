const mongoose = require('mongoose');

const deliveryBoySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, unique: true, sparse: true },
    phone: { type: String, unique: true, sparse: true },
    password: { type: String, required: true },
    countryCode: { type: String, required: true },
    dob: { type: String },
    accountVerify: { type: Boolean, default: false },
    role: { 
      type: String, 
      enum: ['deliveryBoy'], 
      default: 'deliveryBoy' 
    },
    latitude: { type: Number },  // 🌍 Delivery Boy live latitude
    longitude: { type: Number }, // 🌍 Delivery Boy live longitude
    availability: { type: Boolean, default: true }, // 🟢 is available to accept orders
    agencyId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryAgency' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('DeliveryBoy', deliveryBoySchema);