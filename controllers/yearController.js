const Product = require('../models/Product');
const Year = require('../models/Year');

// Create a new year
exports.createYear = async (req, res) => {
  try {
    const newYear = new Year(req.body);
    await newYear.save();
    res.status(201).json({ message: 'Year created successfully', data: newYear,success:true });
  } catch (error) {
    res.status(500).json({ message: 'Error creating year', data: error.message,success:false  });
  }
};

// Get products by year
exports.getProductsByYear = async (req, res) => {
  const { year } = req.params;
  if (!year) {
    return res.status(400).json({ message: 'Year parameter is required', success: false });
  }

  try {
    const products = await Product.find({ year: parseInt(year) });
    res.status(200).json({ message: 'Products by year', success: true, data: products });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching products by year', success: false, data: error.message });
  }
};

// Get all years
exports.getAllYears = async (req, res) => {
  try {
    const years = await Year.find();
    res.status(200).json({ data: years,success:true , message:"years featched" });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching years', data: error.message,success:false  });
  }
};

// Get a single year by ID
exports.getYearById = async (req, res) => {
  try {
    const year = await Year.findById(req.params.id);
    if (!year) {
      return res.status(404).json({ message: 'Year not found',success:true ,data:[] });
    }
    res.status(200).json({ data: year,success:true ,message:"year founded" });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching year', data: error.message,success:true  });
  }
};

// Update year by ID
exports.updateYear = async (req, res) => {
  try {
    const updatedYear = await Year.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!updatedYear) {
      return res.status(404).json({ message: 'Year not found',success:false ,data:[] });
    }
    res.status(200).json({ message: 'Year updated successfully', data: updatedYear,success:true });
  } catch (error) {
    res.status(500).json({ message: 'Error updating year', data: error.message ,success:false });
  }
};

// Delete year by ID
exports.deleteYear = async (req, res) => {
  try {
    const deletedYear = await Year.findByIdAndDelete(req.params.id);
    if (!deletedYear) {
      return res.status(404).json({ message: 'Year not found',success:false ,data:[] });
    }
    res.status(200).json({ message: 'Year deleted successfully',success:true,data:deletedYear  });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting year', data: error.message,success:false  });
  }
};
