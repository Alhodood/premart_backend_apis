const Category = require('../models/Categories');
const Product = require('../models/_deprecated/Product');

// Create a new category
exports.createCategory = async (req, res) => {
  try {
    const newCategory = new Category(req.body);
    await newCategory.save();
    res.status(201).json({ message: 'Category created successfully', data: newCategory,success:true });
  } catch (error) {
    res.status(500).json({ message: 'Error creating category', data: error.message,success:false });
  }
};

// Get all categories
exports.getAllCategory = async (req, res) => {
  try {
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
    
    res.status(200).json({ data, success: true, message: "Categories fetched successfully" });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching categories', error: error.message, success: false });
  }
};

// Get category by ID
exports.getCategoryById = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found',data:[],success:false });
    }
    res.status(200).json({ data: category ,success:true,message: "category by id"});
  } catch (error) {
    res.status(500).json({ message: 'Error fetching category', data: error.message,success:false });
  }
};

// Update category by ID
exports.updateCategory = async (req, res) => {
  try {
    const updatedCategory = await Category.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!updatedCategory) {
      return res.status(404).json({ message: 'Category not found' ,success:false});
    }
    res.status(200).json({ message: 'Category updated successfully', data: updatedCategory,success:true });
  } catch (error) {
    res.status(500).json({ message: 'Error updating category', data: error.message,success:false });
  }
};

// Delete category by ID
exports.deleteCategory = async (req, res) => {
  try {
    const deletedCategory = await Category.findByIdAndDelete(req.params.id);
    if (!deletedCategory) {
      return res.status(404).json({ message: 'Category not found' ,success:false,data
        :[]
      });
    }
    res.status(200).json({ message: 'Category deleted successfully', data:deletedCategory,success:true });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting category', data: error.message,success:false });
  }
};




// Get all products by category
exports.getProductsByCategory = async (req, res) => {
  const category = req.params.categoryTab;
  if (!category) {
      return res.status(400).json({ message: 'Category parameter is required', success: false });
  }
  try {
    const products = await Product.find({
      'subCategories.categoryTab': { $regex: new RegExp(category.trim(), 'i') }
    });
    res.status(200).json({
      message: 'Products by category',
      success: true,
      data: products
    });
  } catch (error) {
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
  if (!category) {
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

    res.status(200).json({
      message: 'Parts by category',
      success: true,
      data: parts
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching parts by category',
      success: false,
      data: error.message
    });
  }
};