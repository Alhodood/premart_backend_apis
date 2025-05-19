const mongoose= require('mongoose');

const bannerSchema= new mongoose.Schema({
    title: String,
    isActive: { type: Boolean, default: true },
    redirectScreen:String,
    pic: String, 
    
shopId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shop',
    required: true,
    index: true,
  },

    
},{timestamps: true });
module.exports= mongoose.model('Banner',bannerSchema);
