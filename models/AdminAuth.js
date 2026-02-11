const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { ROLES } = require('../constants/roles');

/* ------------------------------
   SETTINGS (Super Admin only)
--------------------------------*/
const SettingsSchema = new mongoose.Schema({
  appName: { type: String, default: '' },
  supportEmail: { type: String, default: '' },
  supportPhone: { type: String, default: '' },
  supportWhatsapp: { type: String, default: '' },  // ✅ NEW: WhatsApp Number
  platformCommission: { type: Number, default: 0 },
  taxRate: { type: Number, default: 0 },
  stripePublicKey: { type: String, default: '' },
  stripeSecretKey: { type: String, default: '' },
  deliveryCharge: { type: Number, default: 0 },
  freeDeliveryThreshold: { type: Number, default: 500 },  // ✅ NEW
  maxActiveOrdersPerDeliveryBoy: { type: Number, default: 5 },
  perKmRate: { type: Number, default: 2 }  // ✅ NEW
}, { _id: false });


/* ------------------------------
   SUPER ADMIN SCHEMA
--------------------------------*/
const SuperAdminSchema = new mongoose.Schema({
  name: { type: String, required: true },

  email: { type: String, unique: true, sparse: true },
  phone: { type: String, unique: true, sparse: true },

  password: { type: String, required: true },

  countryCode: { type: String, required: true },
  dob: { type: String },

  accountVerify: { type: Boolean, default: true },

  role: {
    type: String,
    enum: Object.values(ROLES),
    default: ROLES.SUPER_ADMIN
  },

  settings: { type: SettingsSchema, default: () => ({}) }

}, { timestamps: true });


/* ------------------------------
   SHOP ADMIN SCHEMA
--------------------------------*/
const ShopAdminSchema = new mongoose.Schema({
  name: { type: String, required: true },

  email: { type: String, unique: true, sparse: true },
  phone: { type: String, unique: true, sparse: true },

  password: { type: String, required: true },

  countryCode: { type: String, },
  dob: { type: String },

  role: {
    type: String,
    enum: Object.values(ROLES),
    default: ROLES.SHOP_ADMIN,
    
  },
  shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop' },
  

  location: { type: String },

  emiratesIdImage: { type: String, },
  companyLicenseImage: { type: String,  }

}, { timestamps: true });




/* ------------------------------
   PASSWORD HASHING (BOTH)
--------------------------------*/
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


/* ------------------------------
   PASSWORD COMPARISON (BOTH)
--------------------------------*/
function comparePassword(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
}

SuperAdminSchema.methods.comparePassword = comparePassword;
ShopAdminSchema.methods.comparePassword = comparePassword;



/* ------------------------------
   EXPORT MODELS
--------------------------------*/
const SuperAdmin = mongoose.model('SuperAdmin', SuperAdminSchema);
const ShopAdmin = mongoose.model('ShopAdmin', ShopAdminSchema);

module.exports = {
  SuperAdmin,
  ShopAdmin
};