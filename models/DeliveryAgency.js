const mongoose = require('mongoose');

const agencyBankDetailsSchema = new mongoose.Schema({
  bankName: { type: String, required: true },
  accountNumber: { type: String, required: true },
  ibanNumber: { type: String, required: true },
  branch: { type: String, required: true },
  swiftCode: { type: String }
}, { timestamps: true });

const agencyDetailsSchema = new mongoose.Schema({
  agencyName: { type: String, required: true },
  agencyAddress: { type: String, required: true },
  agencyMail: { type: String, required: true },
  agencyContact: { type: String, required: true },
  agencyLicenseNumber: { type: String, required: true },
  agencyLicenseExpiry: { type: String, required: true },
  emiratesId: { type: String, required: true },
  agencyLocation: { type: String },
  agencyLicenseImage: { type: String },
  termsAndCondition: { type: String },
  supportMail: { type: String },
  supportNumber: { type: String },
  payoutType: { type: String, enum: ['monthly', 'weekly'], default: 'monthly' },
  agencyBankDetails: agencyBankDetailsSchema
}, { timestamps: true });

const deliveryAgencySchema = new mongoose.Schema({
  agencyDetails: agencyDetailsSchema
}, { timestamps: true });

const DeliveryAgency = mongoose.model('DeliveryAgency', deliveryAgencySchema);

module.exports = { DeliveryAgency };
