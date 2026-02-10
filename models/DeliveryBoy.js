const mongoose = require('mongoose');
const { ROLES } = require('../constants/roles');

const deliveryBoySchema = new mongoose.Schema(
  {
    name: { 
      type: String, 
      default: "New User" 
    },
    email: { 
      type: String, 
      unique: true, 
      sparse: true 
    },
    phone: { 
      type: String, 
      unique: true, 
      sparse: true 
    },
    password: { 
      type: String 
    },
    countryCode: { 
      type: String 
    },
    dob: { 
      type: String 
    },
    licenseNo: { 
      type: String 
    },
    accountVerify: { 
      type: Boolean, 
      default: false 
    },
    isOnline: { 
      type: Boolean, 
      default: false 
    },
    // ✅ FIX: Ensure assignedOrders always has default empty array
    assignedOrders: {
      type: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Order' 
      }],
      default: []  // ✅ CRITICAL FIX
    },
    profileImage: { 
      type: String 
    },
licenseImage: { 
      type: String 
    },
    //licenseImage
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
    latitude: { 
      type: Number 
    },
    longitude: { 
      type: Number 
    },
    availability: { 
      type: Boolean, 
      default: true 
    },
    agencyId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'DeliveryAgency' 
    },
   activeDeviceToken: { 
  type: String, 
  default: null 
},
activeDeviceInfo: {
  type: String,  // e.g. "Samsung Galaxy S21 - Dubai"
  default: null
},
lastLoginAt: {
  type: Date,
  default: null
},
  },
  { timestamps: true }
);

module.exports = mongoose.model('DeliveryBoy', deliveryBoySchema);