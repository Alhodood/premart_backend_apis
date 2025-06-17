const {VinData} = require('../models/VinData');

exports.createVinEntry= async(req, res)=> {
    console.log(req.body);
    // console.log(response);

  try {
    const{vinKey,vinDetails}= req.body


    let vinDoc = await VinData({vinKey:vinKey,data:vinDetails});
    console.log(vinDoc);
    await vinDoc.save();
    return res.status(201).json({
      message: 'New vin data created',
      success: true,data:vinDoc
    });

  } catch (err) {
    console.error("❌ Error saving VIN:", err);
    return res.status(500).json({
        message: ' vin data is empty',
        success: false,data:[]
      });
  }
}

exports.getVinByKey= async(req, res)=> {
    console.log(req.params.vinData);
    try {
      const  {vinNumber}= req.params.vinData;

      const vinDoc = await VinData.findOne({vinNumber});
  if(vinDoc){
    return res.status(200).json({
        message: 'Vin data is here',
        success: true,data:vinDoc
      });
  }else{
    return res.status(200).json({
        message: 'Vin data not founded',
        success: false,data:[]
      }); 
  }
    } catch (err) {
        return res.status(500).json({
            message: 'server error',
            success: false,data:[]
          });     }
  }
  

