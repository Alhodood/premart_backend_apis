const mongoose= require('mongoose');
const product= require("../models/Product");
const dealsSchema= new mongoose.Schema({

    shopId: {type:String, required: true },
    visibility: {type:Boolean, default: true },
    
    products: [product]




    
},{timestamps: true });
module.exports.mongoose.model('Deals',dealsSchema);

