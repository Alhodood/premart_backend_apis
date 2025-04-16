const Model = require('../models/Model');

// Create a new model entry
exports.createModel = async (req, res) => {
  console.log('hai');

  try {
    const newModel = new Model(req.body);
    await newModel.save();
    res.status(201).json({ message: 'Model created successfully', data: newModel });
  } catch (error) {
    res.status(500).json({ message: 'Error creating model', error: error.message });
  }
};

// Get all models
exports.getAllModels = async (req, res) => {
  try {
    const models = await Model.find();
    res.status(200).json({ data: models });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching models', error: error.message });
  }
};

// Get model by ID
exports.getModelById = async (req, res) => {
  try {
    const model = await Model.findById(req.params.id);
    if (!model) {
      return res.status(404).json({ message: 'Model not found' });
    }
    res.status(200).json({ data: model });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching model', error: error.message });
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
      return res.status(404).json({ message: 'Model not found' });
    }
    res.status(200).json({ message: 'Model updated successfully', data: updatedModel });
  } catch (error) {
    res.status(500).json({ message: 'Error updating model', error: error.message });
  }
};

// Delete model by ID
exports.deleteModel = async (req, res) => {
  try {
    const deletedModel = await Model.findByIdAndDelete(req.params.id);
    if (!deletedModel) {
      return res.status(404).json({ message: 'Model not found' });
    }
    res.status(200).json({ message: 'Model deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting model', error: error.message });
  }
};
