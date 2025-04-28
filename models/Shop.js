const mongoose = require('mongoose');

const bankDetailsSchema = new mongoose.Schema({
    bankName: { type: String, required: true },
    accountNumber: { type: String, required: true },
    ibanNuber: { type: String, required: true },
    branch: { type: String, required: true },
    swiftCode: { type: String }
},{ timestamps: true });


const shopDetailsSchema = new mongoose.Schema({
    shopName: { type: String, required: true },
    shopAddress: { type: String, required: true },
    shopMail: { type: String, required: true },
    shopContact: { type: String, required: true },
    shopLicenseNumber: { type: String, required: true },
    shopLicenseExpiry: { type: String, required: true },
    EmiratesId: { type: String, required: true },
    shopLocation: { type: String },
    shopLicenseImage: { type: String },
    termsAndCondition: { type: String },
    supportMail: { type: String },
    supportNumber: { type: String },
    shopBankDetails: bankDetailsSchema


}, { timestamps: true });


const shopSchema = new mongoose.Schema({
    // shopId:String,
    shopeDetails: shopDetailsSchema
},{ timestamps: true });


const BankDetails = mongoose.model('BankDetails', bankDetailsSchema);
const ShopeDetails = mongoose.model('ShopeDetails', shopDetailsSchema);
const Shop = mongoose.model('Shop', shopSchema);

module.exports = { BankDetails, ShopeDetails, Shop };
