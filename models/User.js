const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const cardDetailsSchema = new mongoose.Schema({
  cardHolderName: { type: String, required: true },
  // email: { type: String, required: true },
  cardNumber: { type: String, required: true },
  expiry: { type: String, required: true },
  cvv: { type: String, required: true },
}, { timestamps: true });
const customerAddressDetailsSchema = new mongoose.Schema({
  name: { type: String, required: true },
  address: { type: String },
  contact: { type: String, required: true },
  area: { type: String, required: true },
  place: { type: String, required: true },
  default: { type: Boolean, required: true,defult:false },
  addressType: {type: String,required: true}
}, { timestamps: true });
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true, sparse: true },
  phone: { type: String, unique: true, sparse: true },
  password: { type: String, required: true },
  accountVisibility: { type: Boolean ,default:true},
  dob: String,
  accountVerify:{type: Boolean, default:false},
  role: {
    type: String,
    enum: ['customer', 'superAdmin', 'shopAdmin'],
    default: 'customer'
  }, address: [customerAddressDetailsSchema],
  card:[cardDetailsSchema],
}, { timestamps: true });

UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

UserSchema.methods.comparePassword = function (password) {
  return bcrypt.compare(password, this.password);
};


module.exports = mongoose.model('User', UserSchema);