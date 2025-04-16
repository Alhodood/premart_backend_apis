const mongoose= require('mongoose');

const couponDetails= new mongoose.Schema({
    title: {type:String, required: true },
    subTitle: String,
    Image: String,
    couponCode:{type:String, required: true },
    startDate:{type:Date, required: true },
    endDate:{type:Date, required: true },
    discountPersantage: String




    
},{timestamps: true });


const couponSchema= new mongoose.Schema({
    shopeId: {type:String, required: true },
    cartProduct: [couponDetails]
},{timestamps: true });
module.exports.mongoose.model('Coupon',couponSchema);

