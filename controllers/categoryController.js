const Category = require('../models/categories');

// Create a new product
exports.createCategories = async (req, res) => {
  try {
    // For security, you can use middleware to ensure only Shop Admin can call this endpoint.
    const category = new Category(req.body);
    const savedCategory = await category.save();
    res.status(201).json({data:savedCategory, message:"New category created",success:true});
  } catch (error) {
    res.status(500).json({ message: 'Failed to create category', data: error.message ,success:false});
  }
};

// Retrieve all products with filtering and pagination
exports.getCategory = async (req, res) => {
  try {
    // Optional filtering and pagination. By default, page 1 and limit 10.
    const { page = 1, limit = 10,  } = req.query;
    // let filter = {};
    // if (category) filter.category = category;
    // if (brand) filter.brand = brand;

    // Using lean() for improved read performance.
    const categories = await Category.find()
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();
    res.status(200).json({message:"categories featched",success: true,data:categories});
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch products', data: error.message ,success: false});
  }
};

// Retrieve a single product by ID
exports.getCategoriesById = async (req, res) => {
  try {
    const cattegories = await Category.findById(req.params.id).lean();
    if (!cattegories) {
      return res.status(404).json({ message: 'Category not found',success: false,data:[] });
    }
    res.status(200).json({data:cattegories ,success: true,message:'category featched'});
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch category', data: error.message ,success: false });
  }
};

// Update a product by ID
exports.updateCategory = async (req, res) => {
  try {
    const updatedCategories = await Category.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!updatedCategories) {
      return res.status(404).json({ message: 'Category not found' ,success: false,data:[]});
    }
    res.status(200).json({success: true,data:updatedCategories, message:"Category updated"});
  } catch (error) {
    res.status(500).json({ message: 'Failed to update category', data: error.message ,success: false});
  }
};

// Delete a product by ID
exports.deleteCategories = async (req, res) => {
  try {
    const deletedCategory = await Category.findByIdAndDelete(req.params.id);
    if (!deletedCategory) {
      return res.status(404).json({ message: 'Category not found',data:[], success: false});
    }
    res.status(200).json({ message: 'Category deleted successfully',data:[] ,success:true});
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete Category', data: error.message,success: false });
  }
};
