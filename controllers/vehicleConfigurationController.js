const VehicleConfiguration = require('../models/VehicleConfiguration');

// CREATE
exports.createConfig = async (req, res) => {
  try {
    const { brand, model, year } = req.body;

    if (!brand || !model || !year) {
      return res.status(400).json({
        success: false,
        message: 'brand, model, year are required'
      });
    }

    const config = await VehicleConfiguration.create(req.body);

    const populated = await VehicleConfiguration.findById(config._id)
      .populate('brand model');

    res.status(201).json({ success: true, data: populated });

  } catch (err) {
    console.error('Create VehicleConfig Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};


// GET ALL
exports.getAllConfigs = async (req, res) => {
  try {
    const configs = await VehicleConfiguration.find({ isActive: true })
      .populate('brand model')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: configs.length,
      data: configs
    });

  } catch (err) {
    console.error('Get All VehicleConfigs Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};


// GET BY ID
exports.getConfigById = async (req, res) => {
  try {
    const config = await VehicleConfiguration.findById(req.params.id)
      .populate('brand model');

    if (!config || !config.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle configuration not found'
      });
    }

    res.json({ success: true, data: config });

  } catch (err) {
    console.error('Get VehicleConfig Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};


// SEARCH / FILTER
exports.searchConfigs = async (req, res) => {
  try {
    const {
      brand,
      model,
      engineType,
      transmission,
      year,
      frameCode,
      region
    } = req.query;

    const filter = { isActive: true };

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
    console.error('Search VehicleConfigs Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};


// UPDATE
exports.updateConfig = async (req, res) => {
  try {
    const updated = await VehicleConfiguration.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    ).populate('brand model');

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Config not found'
      });
    }

    res.json({ success: true, data: updated });

  } catch (err) {
    console.error('Update VehicleConfig Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};


exports.deleteConfig = async (req, res) => {
  try {
    console.log('========== DELETE REQUEST ==========');
    console.log('Request ID:', req.params.id);
    console.log('Request Method:', req.method);
    console.log('Request URL:', req.originalUrl);
    
    // Validate MongoDB ObjectId format
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      console.log('❌ Invalid ObjectId format');
      return res.status(400).json({
        success: false,
        message: 'Invalid ID format'
      });
    }
    
    const config = await VehicleConfiguration.findByIdAndDelete(req.params.id);

    if (!config) {
      console.log('❌ Vehicle config not found in database');
      return res.status(404).json({
        success: false,
        message: 'Vehicle configuration not found'
      });
    }

    console.log('✅ Vehicle config deleted successfully');
    console.log('Deleted config:', {
      id: config._id,
      brand: config.brand,
      model: config.model
    });

    return res.status(200).json({ 
      success: true, 
      message: 'Vehicle configuration deleted successfully',
      data: config 
    });

  } catch (err) {
    console.error('❌ Delete VehicleConfig Error:', err.message);
    console.error('Error stack:', err.stack);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to delete vehicle configuration',
      error: err.message 
    });
  }
};

exports.searchByVin = async (req, res) => {
  try {
    const { vin } = req.query;
    
    if (!vin) {
      return res.status(400).json({
        success: false,
        message: 'VIN number is required'
      });
    }

    // Normalize VIN (uppercase, remove spaces)
    const normalizedVin = vin.trim().toUpperCase().replace(/\s+/g, '');
    
    // ✅ Allow minimum 3 characters
    if (normalizedVin.length < 3) {
      return res.status(400).json({
        success: false,
        message: 'VIN must be at least 3 characters'
      });
    }

    console.log('🔍 Searching for VIN:', normalizedVin);

    // Get all active vehicle configurations
    const allConfigs = await VehicleConfiguration.find({ isActive: true })
      .populate('brand model');

    console.log('📦 Total active configs:', allConfigs.length);

    // ✅ SIMPLIFIED MATCHING: Just check if any vinPattern starts with the user input
    const matchingConfigs = allConfigs.filter(config => {
      if (!config.vinPatterns || config.vinPatterns.length === 0) {
        return false;
      }

      // Check if any VIN pattern starts with the user's input
      const hasMatch = config.vinPatterns.some(pattern => {
        const normalizedPattern = pattern.trim().toUpperCase().replace(/\s+/g, '');
        
        console.log('Comparing:', { normalizedVin, normalizedPattern });
        
        // ✅ Simple startsWith check
        const matches = normalizedPattern.startsWith(normalizedVin);
        
        if (matches) {
          // ✅ FIXED: Use parentheses () not backticks
          console.log(`✅ MATCH FOUND: "${normalizedVin}" matches start of "${normalizedPattern}"`);
        }
        
        return matches;
      });

      if (hasMatch) {
        // ✅ FIXED: Use parentheses () not backticks
        console.log(`✅ Config matched: Brand=${config.brand?.brandName}, Model=${config.model?.modelName}`);
      }

      return hasMatch;
    });

    // ✅ FIXED: Use parentheses () not backticks
    console.log(`✅ Total matches found: ${matchingConfigs.length}`);

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
    console.error('❌ Search By VIN Error:', err.message);
    console.error('Stack:', err.stack);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to search VIN',
      error: err.message 
    });
  }
};