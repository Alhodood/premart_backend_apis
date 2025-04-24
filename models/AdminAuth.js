const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const AdminSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, unique: true, sparse: true },
    phone: { type: String, unique: true, sparse: true },
    password: { type: String, required: true },
    countryCode:{ type: String, required: true },
    dob:{ type: String },
    accountVerify:{type:Boolean},
    role: { type: String, enum: ['customer', 'shopAdmin', 'superAdmin', 'deliveryBoy'], default: 'superAdmin' }
    // Fields for OTP login
   
  },
  { timestamps: true }
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
    role: { type: String,required: true},
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
