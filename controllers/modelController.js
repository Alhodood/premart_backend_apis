const Model = require('../models/Model');
const Product = require('../models/Product');
// Create a new model entry
exports.createModel = async (req, res) => {
  console.log('hai');

  try {
    const newModel = new Model(req.body);
    await newModel.save();
    res.status(201).json({ message: 'Model created successfully', data: newModel, success:true });
  } catch (error) {
    res.status(500).json({ message: 'Error creating model', error: error.message, success:false });
  }
};

// Get all models
exports.getAllModels = async (req, res) => {
  try {
    const models = await Model.find();
    res.status(200).json({ data: models, success:true , message:"featched on models"});
  } catch (error) {
    res.status(500).json({ message: 'Error fetching models', error: error.message, success:false });
  }
};

// Get model by ID
exports.getModelById = async (req, res) => {
  try {
    const model = await Model.findById(req.params.id);
    if (!model) {
      return res.status(404).json({ message: 'Model not found', success:false });
    }
    res.status(200).json({ data: model, success:true, message:"featched model by id" });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching model', error: error.message, success:false });
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
      return res.status(404).json({ message: 'Model not found', success:false , data:[]});
    }
    res.status(200).json({ message: 'Model updated successfully', data: updatedModel , success:true});
  } catch (error) {
    res.status(500).json({ message: 'Error updating model', data: error.message,  success:false });
  }
};

// Delete model by ID
exports.deleteModel = async (req, res) => {
  try {
    const deletedModel = await Model.findByIdAndDelete(req.params.id);
    if (!deletedModel) {
      return res.status(404).json({ message: 'Model not found', success:false, data:[] });
    }
    res.status(200).json({ message: 'Model deleted successfully',  success:true , data:deletedModel});
  } catch (error) {
    res.status(500).json({ message: 'Error deleting model', data: error.message,  success:false });
  }
};



// Get products by model name
exports.getProductsByModel = async (req, res) => {
  const { modelName } = req.params;
  try {
    const products = await Product.find({ model: modelName });
    res.status(200).json({
      success: true,
      message: `Fetched products for model: ${modelName}`,
      data: products,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching products by model',
      error: error.message,
    });
  }
};
