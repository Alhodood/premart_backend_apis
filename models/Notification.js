const mongoose= require('mongoose');

const notificationSchema= new mongoose.Schema({

    shopId: {type:String, required: true },
    title: {type:String, required: true }, 
    
    content: {type:String, required: true }, 
      pic: String


    
},{timestamps: true });
module.exports= mongoose.model('Notification',notificationSchema);

