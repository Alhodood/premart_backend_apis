const mongoose = require('mongoose');
const Model = require('../models/Model');
const Brand = require('../models/Brand');
const Product = require('../models/_deprecated/Product');

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
    res.status(200).json({ data: brands ,success:true, message:"brand featched"});
  } catch (error) {
    res.status(500).json({ message: 'Error fetching brands', data: error.message, success:false });
  }
};

// Get a single brand by ID
exports.getBrandById = async (req, res) => {
  try {
    const brand = await Brand.findById(req.params.id);
    if (!brand) {
      return res.status(404).json({ message: 'Brand not found',success:false ,data:[]});
    }
    res.status(200).json({ data: brand, success:true,message: "brand featched" });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching brand', data: error.message,success:false });
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
      return res.status(404).json({ message: 'Brand not found' ,success:false});
    }
    res.status(200).json({ message: 'Brand updated successfully', data: updatedBrand ,success:true});
  } catch (error) {
    res.status(500).json({ message: 'Error updating brand', data: error.message, success:false });
  }
};

//Delete brand by ID
exports.deleteBrand = async (req, res) => {
  try {
    const deletedBrand = await Brand.findByIdAndDelete(req.params.id);
    if (!deletedBrand) {
      return res.status(404).json({ message: 'Brand not found',success:false , data:[]});
    }
    res.status(200).json({ message: 'Brand deleted successfully', success:true ,data:this.deleteBrand});
  } catch (error) {
    res.status(500).json({ message: 'Error deleting brand', data: error.message, success:false });
  }
};

// Get all products for a specific brand
exports.getProductsByBrand = async (req, res) => {
  const { brandId } = req.params;

  if (!brandId) {
    return res.status(400).json({ message: 'Brand ID is required', success: false });
  }

  try {
    const existing = await Brand.findById(brandId);
    if (!existing) {
      return res.status(404).json({ message: 'Brand not found', success: false });
    }

    const products = await Product.find({ brand: existing.brandName });

    res.status(200).json({
      message: 'Products fetched successfully',
      success: true,
      data: products
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching products by brand',
      success: false,
      error: error.message
    });
  }
};

// Get all models for a specific brand name
exports.getModelsByBrand = async (req, res) => {
  const { brandId } = req.params;
  if (!brandId) {
    return res.status(400).json({ message: 'Brand ID is required', success: false });
  }

  try {
    // Optional: verify brand exists
    const existing = await Brand.findById(brandId);
    if (!existing) {
      return res.status(404).json({ message: 'Brand not found', success: false });
    }

    const models = await Model.find({ brand: brandId, visibility: true });

    res.status(200).json({
      message: 'Models fetched successfully',
      success: true,
      data: models
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching models by brand',
      success: false,
      error: error.message
    });
  }
};
