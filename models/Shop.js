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
    shopLocation: { type: String },
    shopLicenseImage: { type: String },
    termsAndCondition: { type: String },
    supportMail: { type: String },
    supportNumber: { type: String },
    password: { type: String },
    shopBankDetails: bankDetailsSchema


}, { timestamps: true });


const shopSchema = new mongoose.Schema({
    shopeDetails: shopDetailsSchema,
    products: { type: Array, default: [] },
    orders: [
        {
            orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },

        }
    ]
},{ timestamps: true });


const Shop = mongoose.model('Shop', shopSchema);

module.exports = { Shop };
