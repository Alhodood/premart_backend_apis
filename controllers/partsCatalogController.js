const PartsCatalog = require('../models/PartsCatalog');

exports.createPart = async (req, res) => {
  try {
    const part = await PartsCatalog.create(req.body);
    res.status(201).json({ success: true, data: part });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

exports.getAllParts = async (req, res) => {
  try {
    const parts = await PartsCatalog.find()
      .populate('brand model category');
    res.json({ success: true, data: parts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getPartById = async (req, res) => {
  try {
    const part = await PartsCatalog.findById(req.params.id)
      .populate('brand model category');

    if (!part) {
      return res.status(404).json({ success: false, message: 'Part not found' });
    }

    res.json({ success: true, data: part });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.searchParts = async (req, res) => {
  try {
    const { partNumber, brand, model, category } = req.query;

    const filter = {};
    if (partNumber) filter.partNumber = new RegExp(partNumber, 'i');
    if (brand) filter.brand = brand;
    if (model) filter.model = model;
    if (category) filter.category = category;

    const results = await PartsCatalog.find(filter)
      .populate('brand model category');

    res.json({ success: true, data: results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.deactivatePart = async (req, res) => {
  const part = await PartsCatalog.findByIdAndUpdate(
    req.params.id,
    { isActive: false },
    { new: true }
  );
  res.json({ success: true, data: part });
};