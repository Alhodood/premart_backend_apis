const Category = require('../models/Categories');

// Create a new category
exports.createCategory = async (req, res) => {
  try {
    const newCategory = new Category(req.body);
    await newCategory.save();
    res.status(201).json({ message: 'Category created successfully', data: newCategory,success:true });
  } catch (error) {
    res.status(500).json({ message: 'Error creating category', error: error.message,success:false });
  }
};

// Get all categories
exports.getAllCategories = async (req, res) => {
  try {
    const categories = await Category.find();
    res.status(200).json({ data: categories ,message:"list of categories",success:true});
  } catch (error) {
    res.status(500).json({ message: 'Error fetching categories', error: error.message ,success:false});
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
    res.status(500).json({ message: 'Error fetching category', error: error.message,success:false });
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
    res.status(500).json({ message: 'Error updating category', error: error.message,success:false });
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
    res.status(500).json({ message: 'Error deleting category', error: error.message,success:false });
  }
};
