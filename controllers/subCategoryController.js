const SubCategory = require('../models/SubCategory');

// Add SubCategory
exports.addSubCategory = async (req, res) => {
  try {
    const { subCategoryName, subCategoryImage, category } = req.body;

    const newSubCategory = new SubCategory({
      subCategoryName,
      subCategoryImage,
      category,
    });

    const saved = await newSubCategory.save();
    res.status(201).json({ success: true, message: "SubCategory created", data: saved });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to create SubCategory", error: error.message });
  }
};

// Update SubCategory
exports.updateSubCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { subCategoryName, subCategoryImage, category } = req.body;
    const updatedData = { subCategoryName, subCategoryImage, category };
    const updated = await SubCategory.findByIdAndUpdate(id, updatedData, { new: true });
    if (!updated) return res.status(404).json({ success: false, message: "SubCategory not found" });
    res.status(200).json({ success: true, message: "SubCategory updated", data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update SubCategory", error: error.message });
  }
};

// Delete SubCategory
exports.deleteSubCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await SubCategory.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ success: false, message: "SubCategory not found" });
    res.status(200).json({ success: true, message: "SubCategory deleted", data: deleted });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to delete SubCategory", error: error.message });
  }
};

// View all SubCategories
exports.getAllSubCategories = async (req, res) => {
  try {
    const subCategories = await SubCategory.find()
      .populate('category', 'categoryName categoryImage')
      .lean();
    const data = subCategories.map(sc => ({
      _id: sc._id,
      subCategoryName: sc.subCategoryName,
      subCategoryImage: sc.subCategoryImage,
      categoryId: sc.category?._id,
      categoryName: sc.category?.categoryName,
      visibility: sc.visibility,
      createdAt: sc.createdAt,
      updatedAt: sc.updatedAt,
      __v: sc.__v
    }));
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch SubCategories", error: error.message });
  }
};

// Get sub-categories for a specific category ID
exports.getSubCategoriesByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const subs = await SubCategory.find({ category: categoryId })
      .populate('category', 'categoryName categoryImage');
    res.status(200).json({
      success: true,
      message: 'SubCategories fetched successfully',
      data: subs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch SubCategories by category',
      error: error.message
    });
  }
};
