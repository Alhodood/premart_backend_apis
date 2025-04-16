const Fuel = require('../models/Fuel');

// Create a new fuel category
exports.createFuel = async (req, res) => {
  console.log('hai');
  try {
    const newFuel = new Fuel(req.body);
    await newFuel.save();
    res.status(201).json({ message: 'Fuel created successfully', data: [newFuel],success:true });
  } catch (error) {
    res.status(500).json({ message: 'Error creating fuel', data: error.message,success:false });
  }
};

// Get all fuel categories
exports.getAllFuels = async (req, res) => {
  try {
    const fuels = await Fuel.find();
    res.status(200).json({ data: fuels,message:"fuel featched",success:true  });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching fuels', data: error.message ,success:false });
  }
};

// Get fuel category by ID
exports.getFuelById = async (req, res) => {
  try {
    const fuel = await Fuel.findById(req.params.id);
    if (!fuel) {
      return res.status(404).json({ message: 'Fuel not found',success:false ,data:[] });
    }
    res.status(200).json({ data: fuel ,success:true ,message:"data featched"});
  } catch (error) {
    res.status(500).json({ message: 'Error fetching fuel', data: error.message ,success:false });
  }
};

// Update fuel category by ID
exports.updateFuel = async (req, res) => {
  try {
    const updatedFuel = await Fuel.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!updatedFuel) {
      return res.status(404).json({ message: 'Fuel not found',success:false , data:[] });
    }
    res.status(200).json({ message: 'Fuel updated successfully', data: updatedFuel,success:true  });
  } catch (error) {
    res.status(500).json({ message: 'Error updating fuel', data: error.message ,success:false });
  }
};

// Delete fuel category by ID
exports.deleteFuel = async (req, res) => {
  try {
    const deletedFuel = await Fuel.findByIdAndDelete(req.params.id);
    if (!deletedFuel) {
      return res.status(404).json({ message: 'Fuel not found',success:false,data:[]  });
    }
    res.status(200).json({ message: 'Fuel deleted successfully',success:false ,data:[] });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting fuel', data: error.message ,success:false });
  }
};
