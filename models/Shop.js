const mongoose = require('mongoose');

const bankDetailsSchema = new mongoose.Schema({
    bankName: { type: String },
    accountNumber: { type: String },
    ibanNuber: { type: String },
    branch: { type: String },
    swiftCode: { type: String }
},{ timestamps: true });


const shopDetailsSchema = new mongoose.Schema({
    shopName: { type: String },
    shopAddress: { type: String },
    shopMail: { type: String },
    
    shopContact: { type: String },
    shopLicenseNumber: { type: String },
    shopLicenseExpiry: { type: String },
    EmiratesId: { type: String },
     EmiratesIdImage: { type: String },
    shopLocation: { type: String },
    shopLicenseImage: { type: String },
    taxRegistrationNumber: { type: String },
    termsAndCondition: { type: String },
    supportMail: { type: String },
    supportNumber: { type: String },
    password: { type: String },
 resetPasswordOTP:     { type: String, default: null },
  resetPasswordExpires: { type: Date,   default: null },
  rejectionReason: {
  type: String,
  default: null
},
rejectedAt: {
  type: Date,
  default: null
},
    shopBankDetails: bankDetailsSchema


}, { timestamps: true });


const shopSchema = new mongoose.Schema({
    shopeDetails: shopDetailsSchema,
    products: { type: Array, default: [] },
    orders: [
        {
            orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },

        }
    ],
    isVerified: { type: Boolean, default: false },
},{ timestamps: true });


const Shop = mongoose.model('Shop', shopSchema);

module.exports = { Shop };
