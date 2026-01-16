const VehicleConfiguration = require('../models/VehicleConfiguration');

// CREATE
exports.createConfig = async (req, res) => {
  try {
    const {
      brand,
      model,
      yearFrom,
      yearTo
    } = req.body;

    if (!brand || !model || !yearFrom || !yearTo) {
      return res.status(400).json({
        success: false,
        message: 'brand, model, yearFrom, yearTo are required'
      });
    }

    if (yearFrom > yearTo) {
      return res.status(400).json({
        success: false,
        message: 'yearFrom cannot be greater than yearTo'
      });
    }

    const config = await VehicleConfiguration.create(req.body);

    const populated = await VehicleConfiguration.findById(config._id)
      .populate('brand model engineType transmission');

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
      .populate('brand model engineType transmission')
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
      .populate('brand model engineType transmission');

    if (!config || !config.isActive) {
      return res.status(404).json({ success: false, message: 'Vehicle configuration not found' });
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
    if (engineType) filter.engineType = engineType;
    if (transmission) filter.transmission = transmission;
    if (frameCode) filter.frameCode = new RegExp(frameCode, 'i');
    if (region) filter.region = new RegExp(region, 'i');

    if (year) {
      filter.$and = [
        { yearFrom: { $lte: Number(year) } },
        { yearTo: { $gte: Number(year) } }
      ];
    }

    const results = await VehicleConfiguration.find(filter)
      .populate('brand model engineType transmission')
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
    ).populate('brand model engineType transmission');

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Config not found' });
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
      return res.status(404).json({ success: false, message: 'Config not found' });
    }

    res.json({ success: true, data: config });

  } catch (err) {
    console.error('Deactivate VehicleConfig Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};