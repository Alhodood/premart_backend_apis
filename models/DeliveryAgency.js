const mongoose = require('mongoose');
const { ROLES } = require('../constants/roles');
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
  month: { type: String }, // e.g., "May 2025" — one record per month, multiple allowed
  paymentDate: { type: Date, default: Date.now },
  transactionId: { type: String },
  paymentMethod: { type: String, enum: ['Bank Transfer', 'Cash', 'Other'], default: 'Bank Transfer' },
  status: { type: String, enum: ['Paid', 'Pending', 'Failed'], default: 'Paid' }
}, { timestamps: true });

const deliveryAgencySchema = new mongoose.Schema({
  agencyDetails: agencyDetailsSchema,
  paymentRecords: [agencyPaymentSchema]
}, { timestamps: true });

const DeliveryAgency = mongoose.model('DeliveryAgency', deliveryAgencySchema);

module.exports = { DeliveryAgency };
