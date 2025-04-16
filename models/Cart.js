const mongoose= require('mongoose');

const cartSchema= new mongoose.Schema({
    userId: {type:String, required: true },
    cartProduct: [{type:String}]
},{timestamps: true });
module.exports=mongoose.model('Cart',cartSchema);

