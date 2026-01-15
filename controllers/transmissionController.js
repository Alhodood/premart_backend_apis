const Transmission = require('../models/Transmission');

// CREATE TRANSMISSION
exports.createTransmission = async (req, res) => {
  try {
    const { type, mechanism, variant, gearCount, layout, oemCode } = req.body;

    if (!type) {
      return res.status(400).json({
        success: false,
        message: 'Transmission type is required'
      });
    }

    // Prevent duplicate OEM code if provided
    if (oemCode) {
      const existing = await Transmission.findOne({ oemCode });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'Transmission with this OEM code already exists'
        });
      }
    }

    const transmission = await Transmission.create({
      type,
      mechanism,
      variant,
      gearCount,
      layout,
      oemCode
    });

    res.status(201).json({
      success: true,
      data: transmission
    });

  } catch (err) {
    console.error('Create Transmission Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};



// GET ALL TRANSMISSIONS
exports.getAllTransmissions = async (req, res) => {
  try {
    const transmissions = await Transmission.find()
      .sort({ type: 1, gearCount: 1 });

    res.json({
      success: true,
      count: transmissions.length,
      data: transmissions
    });

  } catch (err) {
    console.error('Get Transmissions Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};



// GET TRANSMISSION BY ID
exports.getTransmissionById = async (req, res) => {
  try {
    const transmission = await Transmission.findById(req.params.id);

    if (!transmission) {
      return res.status(404).json({
        success: false,
        message: 'Transmission not found'
      });
    }

    res.json({
      success: true,
      data: transmission
    });

  } catch (err) {
    console.error('Get Transmission Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};



// UPDATE TRANSMISSION
exports.updateTransmission = async (req, res) => {
  try {
    const transmission = await Transmission.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!transmission) {
      return res.status(404).json({
        success: false,
        message: 'Transmission not found'
      });
    }

    res.json({
      success: true,
      data: transmission
    });

  } catch (err) {
    console.error('Update Transmission Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};



// DELETE TRANSMISSION (Master data = hard delete intentional)
exports.deleteTransmission = async (req, res) => {
  try {
    const transmission = await Transmission.findByIdAndDelete(req.params.id);

    if (!transmission) {
      return res.status(404).json({
        success: false,
        message: 'Transmission not found'
      });
    }

    res.json({
      success: true,
      message: 'Transmission deleted successfully'
    });

  } catch (err) {
    console.error('Delete Transmission Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};