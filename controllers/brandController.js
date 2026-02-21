const mongoose = require('mongoose');
const Model = require('../models/Model');
const Brand = require('../models/Brand');
const Product = require('../models/_deprecated/Product');
const logger = require('../config/logger');

// Create a new brand
exports.createBrand = async (req, res) => {
  try {
    const { brandName, brandImage, visibility } = req.body;
    logger.info('createBrand: request received', { brandName });

    if (!brandName) {
      logger.warn('createBrand: brand name missing');
      return res.status(400).json({ message: 'Brand name is required' });
    }

    const newBrand = new Brand({
      brandName,
      visibility: visibility !== undefined ? visibility : true,
      ...(brandImage && { brandImage }),
    });
    await newBrand.save();

    logger.info('createBrand: brand created successfully', { id: newBrand._id });
    res.status(201).json({
      message: 'Brand created successfully',
      success: true,
      data: newBrand,
    });
  } catch (error) {
    logger.error('createBrand: failed to create brand', { error });
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
    logger.info('getAllBrands: request received');

    const brands = await Brand.find();

    logger.info('getAllBrands: brands fetched successfully', { count: brands.length });
    res.status(200).json({ data: brands, success: true, message: "brand featched" });
  } catch (error) {
    logger.error('getAllBrands: failed to fetch brands', { error });
    res.status(500).json({ message: 'Error fetching brands', data: error.message, success: false });
  }
};

// Get a single brand by ID
exports.getBrandById = async (req, res) => {
  try {
    const brandId = req.params.id;
    logger.info('getBrandById: request received', { brandId });

    const brand = await Brand.findById(brandId);
    if (!brand) {
      logger.warn('getBrandById: brand not found', { brandId });
      return res.status(404).json({ message: 'Brand not found', success: false, data: [] });
    }

    logger.info('getBrandById: brand fetched successfully', { brandId });
    res.status(200).json({ data: brand, success: true, message: "brand featched" });
  } catch (error) {
    logger.error('getBrandById: failed to fetch brand', { error });
    res.status(500).json({ message: 'Error fetching brand', data: error.message, success: false });
  }
};

// Update brand by ID
exports.updateBrand = async (req, res) => {
  try {
    const brandId = req.params.id;
    logger.info('updateBrand: request received', { brandId, body: req.body });

    const updatedBrand = await Brand.findByIdAndUpdate(brandId, req.body, {
      new: true,
      runValidators: true,
    });
    if (!updatedBrand) {
      logger.warn('updateBrand: brand not found', { brandId });
      return res.status(404).json({ message: 'Brand not found', success: false });
    }

    logger.info('updateBrand: brand updated successfully', { brandId });
    res.status(200).json({ message: 'Brand updated successfully', data: updatedBrand, success: true });
  } catch (error) {
    logger.error('updateBrand: failed to update brand', { error });
    res.status(500).json({ message: 'Error updating brand', data: error.message, success: false });
  }
};

// Delete brand by ID
exports.deleteBrand = async (req, res) => {
  try {
    const brandId = req.params.id;
    logger.info('deleteBrand: request received', { brandId });

    const deletedBrand = await Brand.findByIdAndDelete(brandId);
    if (!deletedBrand) {
      logger.warn('deleteBrand: brand not found', { brandId });
      return res.status(404).json({ message: 'Brand not found', success: false, data: [] });
    }

    logger.info('deleteBrand: brand deleted successfully', { brandId });
    res.status(200).json({ message: 'Brand deleted successfully', success: true, data: this.deleteBrand });
  } catch (error) {
    logger.error('deleteBrand: failed to delete brand', { error });
    res.status(500).json({ message: 'Error deleting brand', data: error.message, success: false });
  }
};

// Get all products for a specific brand
exports.getProductsByBrand = async (req, res) => {
  const { brandId } = req.params;
  logger.info('getProductsByBrand: request received', { brandId });

  if (!brandId) {
    logger.warn('getProductsByBrand: brand ID missing');
    return res.status(400).json({ message: 'Brand ID is required', success: false });
  }

  try {
    const existing = await Brand.findById(brandId);
    if (!existing) {
      logger.warn('getProductsByBrand: brand not found', { brandId });
      return res.status(404).json({ message: 'Brand not found', success: false });
    }

    const products = await Product.find({ brand: existing.brandName });

    logger.info('getProductsByBrand: products fetched successfully', { brandId, count: products.length });
    res.status(200).json({
      message: 'Products fetched successfully',
      success: true,
      data: products
    });
  } catch (error) {
    logger.error('getProductsByBrand: failed to fetch products', { error });
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
  logger.info('getModelsByBrand: request received', { brandId });

  if (!brandId) {
    logger.warn('getModelsByBrand: brand ID missing');
    return res.status(400).json({ message: 'Brand ID is required', success: false });
  }

  try {
    const existing = await Brand.findById(brandId);
    if (!existing) {
      logger.warn('getModelsByBrand: brand not found', { brandId });
      return res.status(404).json({ message: 'Brand not found', success: false });
    }

    const models = await Model.find({ brand: brandId, visibility: true });

    logger.info('getModelsByBrand: models fetched successfully', { brandId, count: models.length });
    res.status(200).json({
      message: 'Models fetched successfully',
      success: true,
      data: models
    });
  } catch (error) {
    logger.error('getModelsByBrand: failed to fetch models', { error });
    res.status(500).json({
      message: 'Error fetching models by brand',
      success: false,
      error: error.message
    });
  }
};