const mongoose = require('mongoose');
const { ROLES } = require('../constants/roles');
const bcrypt = require('bcrypt');

const agencyBankDetailsSchema = new mongoose.Schema({
  bankName: { type: String },
  accountNumber: { type: String },
  ibanNumber: { type: String },
  branch: { type: String },
  swiftCode: { type: String }
}, { timestamps: true });

const agencyDetailsSchema = new mongoose.Schema({
  email: { type: String, unique: true },
  
  password: { type: String },
  agencyName: { type: String },
  agencyAddress: { type: String },
  agencyMail: { type: String },
  agencyContact: { type: String },
  agencyLicenseNumber: { type: String },
  agencyLicenseExpiry: { type: String },
  
  // ✅ NEW FIELDS
  city: { type: String },
  emirates: [{ type: String }], // ✅ CHANGED: Array of strings for multiple emirates
  licenseAuthority: { type: String },
  trn: { type: String },
  
  // Existing fields
  emiratesId: { type: String },
  emiratesIdImage: { type: String },
  profileImage: { type: String },
  agencyLocation: { type: String },
  agencyLicenseImage: { type: String },
  termsAndCondition: { type: String },
  supportMail: { type: String },
  supportNumber: { type: String },
  
  role: {
    type: String,
    enum: Object.values(ROLES),
    default: ROLES.AGENCY,
    index: true
  },
  payoutType: { type: String, enum: ['monthly', 'weekly'], default: 'monthly' },
  agencyBankDetails: agencyBankDetailsSchema
}, { timestamps: true });

const agencyPaymentSchema = new mongoose.Schema({
  amount: { type: Number },
  month: { type: String },
  paymentDate: { type: Date, default: Date.now },
  transactionId: { type: String },
  paymentMethod: { type: String, enum: ['Bank Transfer', 'Cash', 'Other'], default: 'Bank Transfer' },
  status: { type: String, enum: ['Paid', 'Pending', 'Failed'], default: 'Paid' }
}, { timestamps: true });

const deliveryAgencySchema = new mongoose.Schema({
  agencyDetails: agencyDetailsSchema,
  paymentRecords: [agencyPaymentSchema]
}, { timestamps: true });

deliveryAgencySchema.pre('save', async function(next) {
  if (!this.agencyDetails.password) return next();
  if (!this.isModified('agencyDetails.password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.agencyDetails.password = await bcrypt.hash(this.agencyDetails.password, salt);
  next();
});

deliveryAgencySchema.methods.comparePassword = function(candidate) {
  return bcrypt.compare(candidate, this.agencyDetails.password);
};

const DeliveryAgency = mongoose.model('DeliveryAgency', deliveryAgencySchema);
module.exports = { DeliveryAgency };