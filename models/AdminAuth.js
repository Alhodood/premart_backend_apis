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

module.exports = mongoose.model('Admin', AdminSchema);
