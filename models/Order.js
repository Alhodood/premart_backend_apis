const mongoose = require('mongoose');

const { CustomerAddress, CustomerAddressDetailed } = require('../models/CustomerAddress');

const orderDetailsSchema = new mongoose.Schema({
    productId: [],
    deliveryAddress: CustomerAddressDetailed,
    availableCoupon: { type: String, required: true },
    offers: { type: String, required: true },
    totalAmount: { type: String, required: true },
    discount: { type: String, required: true },
    deliverycharge: { type: Boolean, required: true },
    addressType: { type: String, required: true }



}, { timestamps: true });
// const custoerOrderSchema = new mongoose.Schema({
//     userId: { type: String, required: true },
//     customerAddress: ,
//     orderItems: [orderDetailsSchema]
// });

// module.exports.mongoose.model('CustomerAddress', customerAddressDetailsSchema);

// const orderListSchema= new mongoose.Schema({
//     userId: {type:String, required: true },
//     orderList: [{type:String}]
// },{timestamps: true });
// module.exports.mongoose.model('WishList',orderListSchema);



