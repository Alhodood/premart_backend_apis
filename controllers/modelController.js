const Model = require('../models/Model');
const Product = require('../models/_deprecated/Product');
const logger = require('../config/logger'); // ← Winston logger

// Create a new model entry
exports.createModel = async (req, res) => {
  try {
    const newModel = new Model(req.body);
    await newModel.save();
    res.status(201).json({ message: 'Model created successfully', data: newModel, success: true });
  } catch (error) {
    logger.error('Error creating model: ' + error.message, { stack: error.stack });
    res.status(500).json({ message: 'Error creating model', error: error.message, success: false });
  }
};

// Get all models
exports.getAllModels = async (req, res) => {
  try {
    const models = await Model.find()
      .populate({ path: 'brand', select: 'brandName brandImage' })
      .lean()
      .exec();

    // ✅ Flatten brand into top-level fields AND include visibility
    const data = models.map(m => ({
      _id: m._id,
      modelName: m.modelName,
      visibility: m.visibility, // ✅ ADDED - Critical for edit form
      brandId: m.brand?._id || null,
      brandName: m.brand?.brandName || '',
      brandImage: m.brand?.brandImage || '',
      createdAt: m.createdAt, // Optional: useful for sorting/display
      updatedAt: m.updatedAt  // Optional: useful for sorting/display
    }));

    logger.info('Populated models: ' + JSON.stringify(models));

    res.status(200).json({
      data,
      success: true,
      message: "Fetched all models successfully"
    });
  } catch (error) {
    logger.error('Error fetching models: ' + error.message, { stack: error.stack });
    res.status(500).json({
      message: 'Error fetching models',
      error: error.message,
      success: false
    });
  }
};

// Get model by ID
exports.getModelById = async (req, res) => {
  try {
    const model = await Model.findById(req.params.id);
    if (!model) {
      return res.status(404).json({ message: 'Model not found', success: false });
    }
    res.status(200).json({ data: model, success: true, message: "featched model by id" });
  } catch (error) {
    logger.error('Error fetching model: ' + error.message, { stack: error.stack });
    res.status(500).json({ message: 'Error fetching model', error: error.message, success: false });
  }
};

// Update model by ID
exports.updateModel = async (req, res) => {
  try {
    const updatedModel = await Model.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!updatedModel) {
      return res.status(404).json({ message: 'Model not found', success: false, data: [] });
    }
    res.status(200).json({ message: 'Model updated successfully', data: updatedModel, success: true });
  } catch (error) {
    logger.error('Error updating model: ' + error.message, { stack: error.stack });
    res.status(500).json({ message: 'Error updating model', data: error.message, success: false });
  }
};

// Delete model by ID
exports.deleteModel = async (req, res) => {
  try {
    const deletedModel = await Model.findByIdAndDelete(req.params.id);
    if (!deletedModel) {
      return res.status(404).json({ message: 'Model not found', success: false, data: [] });
    }
    res.status(200).json({ message: 'Model deleted successfully', success: true, data: deletedModel });
  } catch (error) {
    logger.error('Error deleting model: ' + error.message, { stack: error.stack });
    res.status(500).json({ message: 'Error deleting model', data: error.message, success: false });
  }
};

// Get products by model ID
exports.getProductsByModel = async (req, res) => {
  const { id: modelId } = req.params;
  try {
    const products = await Product.find({ model: modelId });
    res.status(200).json({
      success: true,
      message: `Fetched products for model ID: ${modelId}`,
      data: products,
    });
  } catch (error) {
    logger.error('Error fetching products by model: ' + error.message, { stack: error.stack });
    res.status(500).json({
      success: false,
      message: 'Error fetching products by model',
      error: error.message,
    });
  }
};

// Get all models for a given brand ID
exports.getModelsByBrand = async (req, res) => {
  const { brandId } = req.params;
  try {
    const models = await Model.find({ brand: brandId });
    res.status(200).json({
      success: true,
      message: `Fetched models for brand ID: ${brandId}`,
      data: models,
    });
  } catch (error) {
    logger.error('Error fetching models by brand: ' + error.message, { stack: error.stack });
    res.status(500).json({
      success: false,
      message: 'Error fetching models by brand',
      error: error.message,
    });
  }
};