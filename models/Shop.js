// const mongoose = require('mongoose');

// const bankDetailsSchema= new mongoose.Schema({
//     bankName: {type:String, required: true },
//     accountNumber: {type:String, required: true },
//     ibanNuber: {type:String, required: true }, 
//     branch: {type:String, required: true },
//     swiftCode:String
// });


// const shopDetailsSchema=new mongoose.Schema({
//     shopName: {type:String, required: true },
//     shopAddress:  {type:String, required: true },
//     shopMail: {type:String, required: true },
//     shopContact: {type:String, required: true },
//     shopLicenseNumber: {type:String, required: true },
//     shopLicenseExpiry: {type:String, required: true },
//     shopBankDetails: bankDetailsSchema,  
//     shopLicenseImage: {type:String },
//     EmiratesId: {type:String, required: true },
//     shopLocation: {type:String},


    
//     termsAndCondition: String,
//     supportMail: String,
//     supportNumber: String,


// },{timestamps: true });


// const shopSchema= new mongoose.Schema({shopeDetails:[shopDetailsSchema]});


// module.exports= mongoose.model('BankDetails',bankDetailsSchema);
// module.exports= mongoose.model('ShopeDetails',shopDetailsSchema);