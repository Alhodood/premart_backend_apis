const PartsCatalog = require('../models/PartsCatalog');
const Engine = require('../models/Engine');
const Transmission = require('../models/Transmission');

// CREATE PART
exports.createPart = async (req, res) => {
  try {
    const {
      partNumber,
      partName,
      brand,
      model,
      category,
      engine,
      transmission
    } = req.body;

    if (!partNumber || !partName || !brand || !model || !category) {
      return res.status(400).json({
        success: false,
        message: 'partNumber, partName, brand, model, category are required'
      });
    }

    // Prevent duplicate partNumber
    const existing = await PartsCatalog.findOne({ partNumber });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Part with this partNumber already exists'
      });
    }

    // Validate optional refs
    if (engine && !(await Engine.findById(engine))) {
      return res.status(400).json({ success: false, message: 'Invalid engine id' });
    }

    if (transmission && !(await Transmission.findById(transmission))) {
      return res.status(400).json({ success: false, message: 'Invalid transmission id' });
    }

    const part = await PartsCatalog.create(req.body);

    const populated = await PartsCatalog.findById(part._id)
      .populate('brand model category engine transmission');

    res.status(201).json({ success: true, data: populated });

  } catch (err) {
    console.error('Create Part Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};



// GET ALL PARTS
exports.getAllParts = async (req, res) => {
  try {
    const parts = await PartsCatalog.find({ isActive: true })
      .populate('brand model category engine transmission')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: parts.length, data: parts });

  } catch (err) {
    console.error('Get All Parts Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};



// GET PART BY ID
exports.getPartById = async (req, res) => {
  try {
    const part = await PartsCatalog.findById(req.params.id)
      .populate('brand model category engine transmission');

    if (!part || !part.isActive) {
      return res.status(404).json({ success: false, message: 'Part not found' });
    }

    res.json({ success: true, data: part });

  } catch (err) {
    console.error('Get Part Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};



// ADVANCED SEARCH
exports.searchParts = async (req, res) => {
  try {
    const {
      partNumber,
      brand,
      model,
      category,
      engine,
      transmission,
      year
    } = req.query;

    const filter = { isActive: true };

    if (partNumber) filter.partNumber = new RegExp(partNumber, 'i');
    if (brand) filter.brand = brand;
    if (model) filter.model = model;
    if (category) filter.category = category;
    if (engine) filter.engine = engine;
    if (transmission) filter.transmission = transmission;

    if (year) {
      filter.$and = [
        { yearFrom: { $lte: Number(year) } },
        { yearTo: { $gte: Number(year) } }
      ];
    }

    const results = await PartsCatalog.find(filter)
      .populate('brand model category engine transmission')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: results.length,
      data: results
    });

  } catch (err) {
    console.error('Search Parts Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};



// SOFT DELETE
exports.deactivatePart = async (req, res) => {
  try {
    const part = await PartsCatalog.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    ).populate('brand model category engine transmission');

    if (!part) {
      return res.status(404).json({ success: false, message: 'Part not found' });
    }

    res.json({ success: true, data: part });

  } catch (err) {
    console.error('Deactivate Part Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};