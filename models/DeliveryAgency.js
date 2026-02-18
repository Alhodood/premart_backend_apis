// models/DeliveryAgency.js
// ✅ OTP fields moved to TOP LEVEL of deliveryAgencySchema
//    Previously they were inside agencyDetailsSchema (WRONG)
//    Controller does: user.resetPasswordOTP = otp  (user = DeliveryAgency doc)
//    So fields MUST be at root level, not nested

const mongoose = require('mongoose');
const { ROLES } = require('../constants/roles');
const bcrypt = require('bcrypt');

const agencyBankDetailsSchema = new mongoose.Schema({
  bankName:      { type: String },
  accountNumber: { type: String },
  ibanNumber:    { type: String },
  branch:        { type: String },
  swiftCode:     { type: String }
}, { timestamps: true });

const agencyDetailsSchema = new mongoose.Schema({
  email:               { type: String, unique: true },
  password:            { type: String },
  agencyName:          { type: String },
  agencyAddress:       { type: String },
  agencyMail:          { type: String },
  agencyContact:       { type: String },
  agencyLicenseNumber: { type: String },
  agencyLicenseExpiry: { type: String },
  city:                { type: String },
  emirates:            [{ type: String }],
  licenseAuthority:    { type: String },
  trn:                 { type: String },
  // ❌ REMOVED from here — OTP fields do NOT belong inside agencyDetails
  emiratesId:          { type: String },
  emiratesIdImage:     { type: String },
  profileImage:        { type: String },
  agencyLocation:      { type: String },
  agencyLicenseImage:  { type: String },
  termsAndCondition:   { type: String },
  supportMail:         { type: String },
  supportNumber:       { type: String },
  role: {
    type:    String,
    enum:    Object.values(ROLES),
    default: ROLES.AGENCY,
    index:   true,
  },
  payoutType:        { type: String, enum: ['monthly', 'weekly'], default: 'monthly' },
  agencyBankDetails: agencyBankDetailsSchema,
}, { timestamps: true });

const agencyPaymentSchema = new mongoose.Schema({
  amount:        { type: Number },
  month:         { type: String },
  paymentDate:   { type: Date, default: Date.now },
  transactionId: { type: String },
  paymentMethod: { type: String, enum: ['Bank Transfer', 'Cash', 'Other'], default: 'Bank Transfer' },
  status:        { type: String, enum: ['Paid', 'Pending', 'Failed'], default: 'Paid' },
}, { timestamps: true });

const deliveryAgencySchema = new mongoose.Schema({
  agencyDetails:  agencyDetailsSchema,
  paymentRecords: [agencyPaymentSchema],
  isVerified:     { type: Boolean, default: false },


  resetPasswordOTP:     { type: String, default: null },
  resetPasswordExpires: { type: Date,   default: null },

}, { timestamps: true });

// Pre-save: only re-hash when agencyDetails.password actually changes
deliveryAgencySchema.pre('save', async function (next) {
  if (!this.agencyDetails.password) return next();
  if (!this.isModified('agencyDetails.password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.agencyDetails.password = await bcrypt.hash(this.agencyDetails.password, salt);
  next();
});

deliveryAgencySchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.agencyDetails.password);
};

const DeliveryAgency = mongoose.model('DeliveryAgency', deliveryAgencySchema);
module.exports = { DeliveryAgency };