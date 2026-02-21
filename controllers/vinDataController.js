const { VinData } = require('../models/VinData');
const logger = require('../config/logger'); // ← only addition at top

exports.createVinEntry = async (req, res) => {
  try {
    const { vinKey, vinDetails } = req.body;
    let vinDoc = await VinData({ vinKey: vinKey, data: vinDetails });
    await vinDoc.save();
    return res.status(201).json({
      message: 'New vin data created',
      success: true, data: vinDoc
    });
  } catch (err) {
    logger.error('createVinEntry failed', { error: err.message, stack: err.stack }); // ← replaced console.error
    return res.status(500).json({
      message: 'vin data is empty',
      success: false, data: []
    });
  }
};

exports.getVinByKey = async (req, res) => {
  try {
    const vinNumber = req.params.vinData;
    const vinDoc = await VinData.findOne({ vinKey: vinNumber });

    if (!vinNumber) {
      return res.status(200).json({
        message: 'searchkey is required',
        success: false, data: []
      });
    }

    if (vinDoc) {
      return res.status(200).json({
        message: 'Vin data fetched successfully',
        success: true, data: vinDoc
      });
    } else {
      return res.status(200).json({
        message: 'Vin data not found',
        success: false, data: []
      });
    }
  } catch (err) {
    logger.error('getVinByKey failed', { vinKey: req.params.vinData, error: err.message, stack: err.stack }); // ← was missing before
    return res.status(500).json({
      message: 'server error',
      success: false, data: []
    });
  }
};