// models/AdminAuth.js
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { ROLES } = require('../constants/roles');

const SettingsSchema = new mongoose.Schema({
  appName: { type: String, default: 'PreMart' },
  supportEmail: { type: String, default: 'support@premart.ae' },
  supportPhone: { type: String, default: '+971XXXXXXXXX' },
  supportWhatsapp: { type: String, default: '+971XXXXXXXXX' },
  platformCommission: { type: Number, default: 5 },
  agencyCommission: { type: Number, default: 2 },
  taxRate: { type: Number, default: 5 },
  stripePublicKey: { type: String, default: '' },
  stripeSecretKey: { type: String, default: '' },
  deliveryCharge: { type: Number, default: 30 },
  freeDeliveryThreshold: { type: Number, default: 500 },
  perKmRate: { type: Number, default: 2 },
  maxActiveOrdersPerDeliveryBoy: { type: Number, default: 5 },
  // ✅ Full address with buildingName
  address: {
    formattedAddress: { type: String, default: '' },
    buildingName: { type: String, default: '' },   // ✅ ADDED
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    placeId: { type: String, default: '' },
    city: { type: String, default: '' },
    country: { type: String, default: 'UAE' },
  }
}, { _id: false });

const SuperAdminSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true, sparse: true },
  phone: { type: String, unique: true, sparse: true },
  password: { type: String, required: true },
  countryCode: { type: String, required: true },
  dob: { type: String },
  accountVerify: { type: Boolean, default: true },
  role: { type: String, enum: Object.values(ROLES), default: ROLES.SUPER_ADMIN },
  settings: { type: SettingsSchema, default: () => ({}) }
}, { timestamps: true });

const ShopAdminSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true, sparse: true },
  phone: { type: String, unique: true, sparse: true },
  password: { type: String, required: true },
  countryCode: { type: String },
  dob: { type: String },
  role: { type: String, enum: Object.values(ROLES), default: ROLES.SHOP_ADMIN },
  shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop' },
  resetPasswordOTP: { type: String },
  resetPasswordExpires: { type: Date },
  location: { type: String },
  emiratesIdImage: { type: String },
  companyLicenseImage: { type: String }
}, { timestamps: true });

async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
}

SuperAdminSchema.pre('save', hashPassword);
ShopAdminSchema.pre('save', hashPassword);

function comparePassword(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
}

SuperAdminSchema.methods.comparePassword = comparePassword;
ShopAdminSchema.methods.comparePassword = comparePassword;

const SuperAdmin = mongoose.model('SuperAdmin', SuperAdminSchema);
const ShopAdmin = mongoose.model('ShopAdmin', ShopAdminSchema);

module.exports = { SuperAdmin, ShopAdmin };