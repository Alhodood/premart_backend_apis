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
    try {
      const vinNumber= req.params.vinData;
      console.log(vinNumber);

      const vinDoc = await VinData.findOne({vinKey:vinNumber});
      if(! vinNumber){
        return res.status(200).json({
            message: 'serchkey is required',
            success: false,data:[]
          });
      }
  if(vinDoc){
    return res.status(200).json({
        message: 'Vin data featched succesfully',
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
  

