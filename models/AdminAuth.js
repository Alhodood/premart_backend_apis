const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { ROLES } = require('../constants/roles');

const SettingsSchema = new mongoose.Schema({
  appName: { type: String, default: '' },
  supportEmail: { type: String, default: '' },
  supportPhone: { type: String, default: '' },
  platformCommission: { type: Number, default: 0 },
  taxRate: { type: Number, default: 0 },
  stripePublicKey: { type: String, default: '' },
  stripeSecretKey: { type: String, default: '' },
  deliveryCharge: { type: Number, default: 0 },
  maxActiveOrdersPerDeliveryBoy: { type: Number, default: 5 }
}, { _id: false });

const AdminSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, unique: true, sparse: true },
    phone: { type: String, unique: true, sparse: true },
    password: { type: String, required: true },
    countryCode:{ type: String, required: true },
    dob:{ type: String },
    accountVerify:{type:Boolean},
  
role: {
  type: String,
  enum: Object.values(ROLES),
  default: ROLES.SUPER_ADMIN
},
    // Fields for OTP login
    // Nested settings for super admin configuration (e.g., commission, tax, Stripe keys)
    settings: { type: SettingsSchema, default: () => ({}) }
  },
  { timestamps: true, minimize: false }
);

// Hash password before saving the user (for email registration)
AdminSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    return next();
  } catch (error) {
    return next(error);
  }
});

// Compare candidate password with the user's hashed password
AdminSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};






const ShopAdminSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, unique: true, sparse: true },
    phone: { type: String, unique: true, sparse: true },
    password: { type: String, required: true },
    countryCode:{ type: String, required: true },
    dob:{ type: String },
    address:{type:Boolean},
   role: {
  type: String,
  enum: Object.values(ROLES),
  default: ROLES.SHOP_ADMIN,
  required: true
},
    location:{type:String},
    emiratesIdImage: {type:String, required:true},
    companyLicenseImage: {type:String, requires:true}
    
    // Fields for OTP login
   
  },
  { timestamps: true }
);

// Hash password before saving the user (for email registration)
ShopAdminSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    return next();
  } catch (error) {
    return next(error);
  }
});

// Compare candidate password with the user's hashed password
ShopAdminSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};
const ShopAdmin = mongoose.model('ShopAdmin', ShopAdminSchema);
const SuperAdmin = mongoose.model('SuperAdmin', AdminSchema);

module.exports = {
  ShopAdmin,
  SuperAdmin
};
