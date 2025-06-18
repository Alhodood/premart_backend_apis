const SubCategory = require('../models/SubCategory');

// Add SubCategory
exports.addSubCategory = async (req, res) => {
  try {
    const { subCategoryName, subCategoryImage } = req.body;

    const newSubCategory = new SubCategory({
      subCategoryName,
      subCategoryImage,
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
    const updated = await SubCategory.findByIdAndUpdate(id, req.body, { new: true });
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
    const subCategories = await SubCategory.find();
    res.status(200).json({ success: true, data: subCategories });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch SubCategories", error: error.message });
  }
};
