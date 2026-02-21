const Category = require('../models/Categories');
const Product = require('../models/_deprecated/Product');
const logger = require('../config/logger');

// Create a new category
exports.createCategory = async (req, res) => {
  try {
    logger.info('createCategory: request received', { body: req.body });

    const newCategory = new Category(req.body);
    await newCategory.save();

    logger.info('createCategory: category created successfully', { id: newCategory._id });
    res.status(201).json({ message: 'Category created successfully', data: newCategory, success: true });
  } catch (error) {
    logger.error('createCategory: failed to create category', { error });
    res.status(500).json({ message: 'Error creating category', data: error.message, success: false });
  }
};

// Get all categories
exports.getAllCategory = async (req, res) => {
  try {
    logger.info('getAllCategory: request received');

    const categories = await Category.find().lean().exec();
    // ✅ Include visibility field
    const data = categories.map(c => ({
      _id: c._id,
      categoryName: c.categoryName,
      categoryImage: c.categoryImage,
      visibility: c.visibility, // ✅ CRITICAL
      createdAt: c.createdAt,
      updatedAt: c.updatedAt
    }));

    logger.info('getAllCategory: categories fetched successfully', { count: data.length });
    res.status(200).json({ data, success: true, message: "Categories fetched successfully" });
  } catch (error) {
    logger.error('getAllCategory: failed to fetch categories', { error });
    res.status(500).json({ message: 'Error fetching categories', error: error.message, success: false });
  }
};

// Get category by ID
exports.getCategoryById = async (req, res) => {
  try {
    const categoryId = req.params.id;
    logger.info('getCategoryById: request received', { categoryId });

    const category = await Category.findById(categoryId);
    if (!category) {
      logger.warn('getCategoryById: category not found', { categoryId });
      return res.status(404).json({ message: 'Category not found', data: [], success: false });
    }

    logger.info('getCategoryById: category fetched successfully', { categoryId });
    res.status(200).json({ data: category, success: true, message: "category by id" });
  } catch (error) {
    logger.error('getCategoryById: failed to fetch category', { error });
    res.status(500).json({ message: 'Error fetching category', data: error.message, success: false });
  }
};

// Update category by ID
exports.updateCategory = async (req, res) => {
  try {
    const categoryId = req.params.id;
    logger.info('updateCategory: request received', { categoryId, body: req.body });

    const updatedCategory = await Category.findByIdAndUpdate(
      categoryId,
      req.body,
      { new: true, runValidators: true }
    );
    if (!updatedCategory) {
      logger.warn('updateCategory: category not found', { categoryId });
      return res.status(404).json({ message: 'Category not found', success: false });
    }

    logger.info('updateCategory: category updated successfully', { categoryId });
    res.status(200).json({ message: 'Category updated successfully', data: updatedCategory, success: true });
  } catch (error) {
    logger.error('updateCategory: failed to update category', { error });
    res.status(500).json({ message: 'Error updating category', data: error.message, success: false });
  }
};

// Delete category by ID
exports.deleteCategory = async (req, res) => {
  try {
    const categoryId = req.params.id;
    logger.info('deleteCategory: request received', { categoryId });

    const deletedCategory = await Category.findByIdAndDelete(categoryId);
    if (!deletedCategory) {
      logger.warn('deleteCategory: category not found', { categoryId });
      return res.status(404).json({ message: 'Category not found', success: false, data: [] });
    }

    logger.info('deleteCategory: category deleted successfully', { categoryId });
    res.status(200).json({ message: 'Category deleted successfully', data: deletedCategory, success: true });
  } catch (error) {
    logger.error('deleteCategory: failed to delete category', { error });
    res.status(500).json({ message: 'Error deleting category', data: error.message, success: false });
  }
};

// Get all products by category
exports.getProductsByCategory = async (req, res) => {
  const category = req.params.categoryTab;
  logger.info('getProductsByCategory: request received', { category });

  if (!category) {
    logger.warn('getProductsByCategory: category parameter missing');
    return res.status(400).json({ message: 'Category parameter is required', success: false });
  }

  try {
    const products = await Product.find({
      'subCategories.categoryTab': { $regex: new RegExp(category.trim(), 'i') }
    });

    logger.info('getProductsByCategory: products fetched successfully', { category, count: products.length });
    res.status(200).json({
      message: 'Products by category',
      success: true,
      data: products
    });
  } catch (error) {
    logger.error('getProductsByCategory: failed to fetch products', { error });
    res.status(500).json({
      message: 'Error fetching products by category',
      success: false,
      data: error.message
    });
  }
};

// Get all parts by category
exports.getPartsByCategory = async (req, res) => {
  const category = req.params.categoryTab;
  logger.info('getPartsByCategory: request received', { category });

  if (!category) {
    logger.warn('getPartsByCategory: category parameter missing');
    return res.status(400).json({ message: 'Category parameter is required', success: false });
  }

  try {
    const products = await Product.find({
      'subCategories.categoryTab': { $regex: new RegExp(category.trim(), 'i') }
    });

    const parts = [];
    const normalizedCategory = category.toLowerCase().trim();
    products.forEach(product => {
      product.subCategories.forEach(subCat => {
        if (subCat.categoryTab && subCat.categoryTab.toLowerCase().trim() === normalizedCategory) {
          parts.push(...subCat.parts);
        }
      });
    });

    logger.info('getPartsByCategory: parts fetched successfully', { category, count: parts.length });
    res.status(200).json({
      message: 'Parts by category',
      success: true,
      data: parts
    });
  } catch (error) {
    logger.error('getPartsByCategory: failed to fetch parts', { error });
    res.status(500).json({
      message: 'Error fetching parts by category',
      success: false,
      data: error.message
    });
  }
};