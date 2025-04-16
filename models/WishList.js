const mongoose= require('mongoose');

const wishListSchema= new mongoose.Schema({
    userId: {type:String, required: true },
    wishListProduct: [{type:String}]
},{timestamps: true });
module.exports=mongoose.model('WishList',wishListSchema);

