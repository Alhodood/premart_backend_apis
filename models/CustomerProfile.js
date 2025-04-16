
const mongoose= require('mongoose');

// const CustomerAddress= require("../models/CustomerAddress");

const customerProfileDetailsSchema= new mongoose.Schema({
    name: {type:String, required: true },
    email: {type:String, required: true },
    dob: {type:String, required: true },
    contact: {type:String, required: true },
    deviceId: {type:String, required: true },
    image: String,
    

},{timestamps: true });


const customerProfileSchema= new mongoose.Schema({userId: {type:String, required: true },
    customerAddress: customerProfileDetailsSchema});


module.exports.mongoose.model('CustomerProfile',customerProfileSchema);


