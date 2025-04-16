const mongoose= require('mongoose');

const bannerSchema= new mongoose.Schema({
    title: String,
    pic: String, 
    visibility:{ type: Boolean, default: true }


    
},{timestamps: true });
module.exports= mongoose.model('Banner',bannerSchema);

