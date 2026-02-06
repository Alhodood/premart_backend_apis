// models/SuperAdminSettings.js
const mongoose = require('mongoose');

const superAdminSettingsSchema = new mongoose.Schema({
  superAdminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  appName: {
    type: String,
    default: 'PreMart'
  },
  supportEmail: {
    type: String,
    default: 'support@premart.com'
  },
  supportPhone: {
    type: String,
    default: '+971-XXX-XXXX'
  },
  
  // ✅ COMMISSION SETTINGS
  platformCommission: {
    type: Number,
    default: 10, // percentage - DEPRECATED (use shopCommission instead)
    min: 0,
    max: 100
  },
  shopCommission: {
    type: Number,
    default: 5, // percentage - Platform commission from shop sales
    min: 0,
    max: 100
  },
  agencyCommission: {
    type: Number,
    default: 2, // percentage - Platform commission from agency earnings
    min: 0,
    max: 100
  },
  
  taxRate: {
    type: Number,
    default: 5, // percentage
    min: 0,
    max: 100
  },
  stripePublicKey: {
    type: String,
    default: ''
  },
  stripeSecretKey: {
    type: String,
    default: ''
  },
  deliveryCharge: {
    type: Number,
    default: 30, // AED
    min: 0
  },
  freeDeliveryThreshold: {
    type: Number,
    default: 500, // AED
    min: 0
  },
  maxActiveOrdersPerDeliveryBoy: {
    type: Number,
    default: 5,
    min: 1,
    max: 20
  },
  perKmRate: {
    type: Number,
    default: 2, // AED per km
    min: 0
  },
  currency: {
    type: String,
    default: 'AED'
  },
  currencySymbol: {
    type: String,
    default: 'AED'
  },
  maintenanceMode: {
    type: Boolean,
    default: false
  },
  appVersion: {
    type: String,
    default: '1.0.0'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('SuperAdminSettings', superAdminSettingsSchema);