const Engine = require('../models/Engine');

// CREATE ENGINE
exports.createEngine = async (req, res) => {
  try {
    const { code, displacement, fuelType, cylinders } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Engine code is required'
      });
    }

    const existing = await Engine.findOne({ code });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Engine with this code already exists'
      });
    }

    const engine = await Engine.create({
      code,
      displacement,
      fuelType,
      cylinders
    });

    res.status(201).json({
      success: true,
      data: engine
    });

  } catch (err) {
    console.error('Create Engine Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};



// GET ALL ENGINES
exports.getAllEngines = async (req, res) => {
  try {
    const engines = await Engine.find().sort({ code: 1 });

    res.json({
      success: true,
      count: engines.length,
      data: engines
    });

  } catch (err) {
    console.error('Get Engines Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};



// GET ENGINE BY ID
exports.getEngineById = async (req, res) => {
  try {
    const engine = await Engine.findById(req.params.id);

    if (!engine) {
      return res.status(404).json({
        success: false,
        message: 'Engine not found'
      });
    }

    res.json({
      success: true,
      data: engine
    });

  } catch (err) {
    console.error('Get Engine Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};



// UPDATE ENGINE
exports.updateEngine = async (req, res) => {
  try {
    const engine = await Engine.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!engine) {
      return res.status(404).json({
        success: false,
        message: 'Engine not found'
      });
    }

    res.json({
      success: true,
      data: engine
    });

  } catch (err) {
    console.error('Update Engine Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};



// DELETE ENGINE (Hard delete intentionally for master data hygiene)
exports.deleteEngine = async (req, res) => {
  try {
    const engine = await Engine.findByIdAndDelete(req.params.id);

    if (!engine) {
      return res.status(404).json({
        success: false,
        message: 'Engine not found'
      });
    }

    res.json({
      success: true,
      message: 'Engine deleted successfully'
    });

  } catch (err) {
    console.error('Delete Engine Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};