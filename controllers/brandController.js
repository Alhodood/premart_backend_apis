const Brand = require('../models/Brand');

// Create a new brand
exports.createBrand = async (req, res) => {
  try {
    const { brandName, brandImage, visibility } = req.body;

    if (!brandName) {
      return res.status(400).json({ message: 'Brand name is required' });
    }

    const newBrand = new Brand({
      brandName,
      visibility: visibility !== undefined ? visibility : true,
      ...(brandImage && { brandImage }), // Only add brandImage if provided
    });

    await newBrand.save();

    res.status(201).json({
      message: 'Brand created successfully',
      success: true,
      data: newBrand,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error creating brand',
      success: false,
      error: error.message,
    });
  }
};
// Get all brands
exports.getAllBrands = async (req, res) => {
  try {
    const brands = await Brand.find();
    res.status(200).json({ data: brands });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching brands', error: error.message });
  }
};

// Get a single brand by ID
exports.getBrandById = async (req, res) => {
  try {
    const brand = await Brand.findById(req.params.id);
    if (!brand) {
      return res.status(404).json({ message: 'Brand not found' });
    }
    res.status(200).json({ data: brand });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching brand', error: error.message });
  }
};

// Update brand by ID
exports.updateBrand = async (req, res) => {
  try {
    const updatedBrand = await Brand.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!updatedBrand) {
      return res.status(404).json({ message: 'Brand not found' });
    }
    res.status(200).json({ message: 'Brand updated successfully', data: updatedBrand });
  } catch (error) {
    res.status(500).json({ message: 'Error updating brand', error: error.message });
  }
};

//Delete brand by ID
exports.deleteBrand = async (req, res) => {
  try {
    const deletedBrand = await Brand.findByIdAndDelete(req.params.id);
    if (!deletedBrand) {
      return res.status(404).json({ message: 'Brand not found' });
    }
    res.status(200).json({ message: 'Brand deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting brand', error: error.message });
  }
};
