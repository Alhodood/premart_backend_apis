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


// SOFT DELETE
exports.deactivateConfig = async (req, res) => {
  try {
    const config = await VehicleConfiguration.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'Config not found'
      });
    }

    res.json({ success: true, data: config });

  } catch (err) {
    console.error('Deactivate VehicleConfig Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};


// SEARCH BY VIN PATTERN
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

    if (normalizedVin.length < 4) {
      return res.status(400).json({
        success: false,
        message: 'VIN must be at least 4 characters'
      });
    }

    // Get all active vehicle configurations
    const allConfigs = await VehicleConfiguration.find({ isActive: true })
      .populate('brand model');

    // Filter configurations where VIN matches any vinPattern
    const matchingConfigs = allConfigs.filter(config => {
      if (!config.vinPatterns || config.vinPatterns.length === 0) {
        return false;
      }

      // Check if VIN matches any pattern in vinPatterns array
      return config.vinPatterns.some(pattern => {
        // Convert wildcard pattern to regex
        // e.g., "4T1B*" becomes "^4T1B" (matches start of string)
        // "*" at end means match from start
        const regexPattern = pattern
          .replace(/\*/g, '.*') // Replace * with .* for regex
          .replace(/\?/g, '.')  // Replace ? with . for single char
          .toUpperCase();

        try {
          const regex = new RegExp(`^${regexPattern}`, 'i');
          return regex.test(normalizedVin);
        } catch (err) {
          // If pattern is invalid, try simple string match
          return normalizedVin.startsWith(pattern.replace(/\*/g, '').toUpperCase());
        }
      });
    });

    res.json({
      success: true,
      count: matchingConfigs.length,
      vin: normalizedVin,
      data: matchingConfigs
    });

  } catch (err) {
    console.error('Search By VIN Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};