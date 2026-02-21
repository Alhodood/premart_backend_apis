const VehicleConfiguration = require('../models/VehicleConfiguration');
const mongoose = require('mongoose'); // ← moved to top, was inside deleteConfig
const logger = require('../config/logger'); // ← only addition at top

// CREATE
exports.createConfig = async (req, res) => {
  try {
    const { brand, model, year, isActive } = req.body;
    if (!brand || !model || !year) {
      return res.status(400).json({
        success: false,
        message: 'brand, model, year are required'
      });
    }

    const configData = {
      ...req.body,
      isActive: isActive !== undefined ? isActive : true
    };

    const config = await VehicleConfiguration.create(configData);
    const populated = await VehicleConfiguration.findById(config._id)
      .populate('brand model');

    res.status(201).json({
      success: true,
      message: 'Vehicle configuration created successfully',
      data: populated
    });
  } catch (err) {
    logger.error('createConfig failed', { error: err.message, stack: err.stack }); // ← replaced console.error
    res.status(500).json({
      success: false,
      message: 'Failed to create vehicle configuration',
      error: err.message
    });
  }
};

// GET ALL
exports.getAllConfigs = async (req, res) => {
  try {
    const configs = await VehicleConfiguration.find()
      .populate('brand model')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: configs.length,
      data: configs
    });
  } catch (err) {
    logger.error('getAllConfigs failed', { error: err.message, stack: err.stack }); // ← replaced console.error
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET BY ID
exports.getConfigById = async (req, res) => {
  try {
    const config = await VehicleConfiguration.findById(req.params.id)
      .populate('brand model');

    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle configuration not found'
      });
    }

    res.json({ success: true, data: config });
  } catch (err) {
    logger.error('getConfigById failed', { id: req.params.id, error: err.message, stack: err.stack }); // ← replaced console.error
    res.status(500).json({ success: false, error: err.message });
  }
};

// SEARCH / FILTER
exports.searchConfigs = async (req, res) => {
  try {
    const { brand, model, engineType, transmission, year, frameCode, region, isActive } = req.query;

    const filter = {};
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (brand) filter.brand = brand;
    if (model) filter.model = model;
    if (year) filter.year = Number(year);
    if (engineType) filter.engineType = new RegExp(engineType, 'i');
    if (transmission) filter.transmission = new RegExp(transmission, 'i');
    if (frameCode) filter.frameCode = new RegExp(frameCode, 'i');
    if (region) filter.region = new RegExp(region, 'i');

    const results = await VehicleConfiguration.find(filter)
      .populate('brand model')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: results.length,
      data: results
    });
  } catch (err) {
    logger.error('searchConfigs failed', { query: req.query, error: err.message, stack: err.stack }); // ← replaced console.error
    res.status(500).json({ success: false, error: err.message });
  }
};

// UPDATE
exports.updateConfig = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      brand, model, year, engineType, transmission,
      frameCode, trim, commonName, vinPatterns, region, isActive
    } = req.body;

    const updatedData = {};
    if (brand !== undefined) updatedData.brand = brand;
    if (model !== undefined) updatedData.model = model;
    if (year !== undefined) updatedData.year = year;
    if (engineType !== undefined) updatedData.engineType = engineType;
    if (transmission !== undefined) updatedData.transmission = transmission;
    if (frameCode !== undefined) updatedData.frameCode = frameCode;
    if (trim !== undefined) updatedData.trim = trim;
    if (commonName !== undefined) updatedData.commonName = commonName;
    if (vinPatterns !== undefined) updatedData.vinPatterns = vinPatterns;
    if (region !== undefined) updatedData.region = region;
    if (isActive !== undefined) updatedData.isActive = isActive;

    const updated = await VehicleConfiguration.findByIdAndUpdate(
      id,
      updatedData,
      { new: true, runValidators: true }
    ).populate('brand model');

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle configuration not found'
      });
    }

    res.json({
      success: true,
      message: 'Vehicle configuration updated successfully',
      data: updated
    });
  } catch (err) {
    logger.error('updateConfig failed', { id: req.params.id, error: err.message, stack: err.stack }); // ← replaced console.error
    res.status(500).json({
      success: false,
      message: 'Failed to update vehicle configuration',
      error: err.message
    });
  }
};

// DELETE
exports.deleteConfig = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ID format'
      });
    }

    const config = await VehicleConfiguration.findByIdAndDelete(req.params.id);

    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle configuration not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Vehicle configuration deleted successfully',
      data: config
    });
  } catch (err) {
    logger.error('deleteConfig failed', { id: req.params.id, error: err.message, stack: err.stack }); // ← replaced console.error
    return res.status(500).json({
      success: false,
      message: 'Failed to delete vehicle configuration',
      error: err.message
    });
  }
};

// SEARCH BY VIN
exports.searchByVin = async (req, res) => {
  try {
    const { vin } = req.query;

    if (!vin) {
      return res.status(400).json({
        success: false,
        message: 'VIN number is required'
      });
    }

    const normalizedVin = vin.trim().toUpperCase().replace(/\s+/g, '');

    if (normalizedVin.length < 3) {
      return res.status(400).json({
        success: false,
        message: 'VIN must be at least 3 characters'
      });
    }

    const allConfigs = await VehicleConfiguration.find({ isActive: true })
      .populate('brand model');

    const matchingConfigs = allConfigs.filter(config => {
      if (!config.vinPatterns || config.vinPatterns.length === 0) return false;

      return config.vinPatterns.some(pattern => {
        const normalizedPattern = pattern.trim().toUpperCase().replace(/\s+/g, '');
        return normalizedPattern.startsWith(normalizedVin);
      });
    });

    res.json({
      success: true,
      count: matchingConfigs.length,
      vin: normalizedVin,
      message: matchingConfigs.length > 0
        ? `Found ${matchingConfigs.length} vehicle(s) matching VIN prefix "${normalizedVin}"`
        : `No vehicles found matching VIN prefix "${normalizedVin}"`,
      data: matchingConfigs
    });
  } catch (err) {
    logger.error('searchByVin failed', { vin: req.query.vin, error: err.message, stack: err.stack }); // ← replaced console.error
    res.status(500).json({
      success: false,
      message: 'Failed to search VIN',
      error: err.message
    });
  }
};