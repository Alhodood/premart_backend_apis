const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { ROLES } = require('../constants/roles');

const cardDetailsSchema = new mongoose.Schema({
  cardHolderName: { type: String },
  // email: { type: String, required: true },
  cardNumber: { type: String },
  expiry: { type: String },
  cvv: { type: String },
}, { timestamps: true });
const customerAddressDetailsSchema = new mongoose.Schema({
  name: { type: String },
  address: { type: String },
  contact: { type: String },
  area: { type: String },
  place: { type: String },
  default: { type: Boolean, defult:false },
  addressType: {type: String},
  latitude: { type: Number },
  longitude: { type: Number },
}, { timestamps: true });
const UserSchema = new mongoose.Schema({
  name: { type: String },
  email: { type: String, unique: true, sparse: true },
  phone: { type: String, unique: true, sparse: true },
  password: { type: String },
  accountVisibility: { type: Boolean ,default:true},
  dob: String,
  accountVerify:{type: Boolean, default:false},
  role: {
  type: String,
  enum: Object.values(ROLES),
  default: ROLES.CUSTOMER,
  index: true
},
 address: [customerAddressDetailsSchema],
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