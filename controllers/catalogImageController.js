const CatalogImage = require('../models/CatalogImages');

// 1. Upload Catalog Image
exports.uploadCatalogImage = async (req, res) => {
  try {
    const { images, brand, model, category, subCategory } = req.body;
    console.log("🧾 Uploading Catalog Image Payload →", {
      images,
      brand,
      model,
      category,
      subCategory
    });

    if (!images || !brand || !model || !category || !subCategory) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const newCatalog = new CatalogImage({ images, brand, model, category, subCategory });
    await newCatalog.save();

    res.status(201).json({ success: true, message: 'Catalog image uploaded successfully', data: newCatalog });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Upload failed', error: error.message });
  }
};

// 2. Get Catalog Image by Filters
exports.getCatalogImages = async (req, res) => {
  try {
    const { brand, model, category, subCategory } = req.query;

    const filters = {};
    if (brand) filters.brand = brand;
    if (model) filters.model = model;
    if (category) filters.category = category;
    if (subCategory) filters.subCategory = subCategory;

    const catalogImages = await CatalogImage.find(filters)
      .populate('brand model category subCategory');

    const responseData = catalogImages.map(ci => ({
      catalogId: ci._id,
      brandId: ci.brand?._id || null,
      brandName: ci.brand?.brandName || null,
      modelId: ci.model?._id || null,
      modelName: ci.model?.modelName || null,
      categoryId: ci.category?._id || null,
      categoryName: ci.category?.categoryName || null,
      subCategoryId: ci.subCategory?._id || null,
      subCategoryName: ci.subCategory?.subCategoryName || null,
      images: ci.images,
      createdAt: ci.createdAt,
    }));

    res.status(200).json({ success: true, data: responseData });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch catalog images', error: error.message });
  }
};

// 3. Delete Catalog Image
exports.deleteCatalogImage = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await CatalogImage.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Catalog not found' });
    }

    res.status(200).json({ success: true, message: 'Catalog image deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Deletion failed', error: error.message });
  }
};

// 4. Update Catalog Image
exports.updateCatalogImage = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const updatedCatalog = await CatalogImage.findByIdAndUpdate(id, updateData, { new: true });
    if (!updatedCatalog) {
      return res.status(404).json({ success: false, message: 'Catalog not found' });
    }

    res.status(200).json({ success: true, message: 'Catalog updated successfully', data: updatedCatalog });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Update failed', error: error.message });
  }
};
// 5. View Catalog Image by ID
exports.viewCatalogImage = async (req, res) => {
  try {
    const { id } = req.params;

    const catalog = await CatalogImage.findById(id).populate('brand model category subCategory');
    if (!catalog) {
      return res.status(404).json({ success: false, message: 'Catalog not found' });
    }

    res.status(200).json({ success: true, data: catalog });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to retrieve catalog image', error: error.message });
  }
};

// 6. Get Catalog Images only when all filters match
exports.getCatalogImagesByAll = async (req, res) => {
  try {
    const { brand, model, category, subCategory } = req.query;
    // Ensure all parameters are provided
    if (!brand || !model || !category || !subCategory) {
      return res.status(400).json({
        success: false,
        message: 'brand, model, category, and subCategory are all required',
      });
    }
    // Find strictly matching entries
    const catalogImages = await CatalogImage.find({
      brand,
      model,
      category,
      subCategory,
    }).populate('brand model category subCategory');

    // Flatten response
    const responseData = catalogImages.map(ci => ({
      catalogId: ci._id,
      brandId: ci.brand?._id || null,
      brandName: ci.brand?.brandName || null,
      modelId: ci.model?._id || null,
      modelName: ci.model?.modelName || null,
      categoryId: ci.category?._id || null,
      categoryName: ci.category?.categoryName || null,
      subCategoryId: ci.subCategory?._id || null,
      subCategoryName: ci.subCategory?.subCategoryName || null,
      images: ci.images,
      createdAt: ci.createdAt,
    }));

    res.status(200).json({ success: true, data: responseData });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch catalog images', error: error.message });
  }
};

// 7. Get Catalog Images by names of brand, model, categoryTab, and subCategoryTab
exports.getCatalogImagesByNames = async (req, res) => {
  try {
    const { brand, model, categoryTab, subCategoryTab } = req.query;
    if (!brand || !model || !categoryTab || !subCategoryTab) {
      return res.status(400).json({
        success: false,
        message: 'brand, model, categoryTab, and subCategoryTab are all required',
      });
    }
    // Retrieve all and populate
    const catalogImages = await CatalogImage.find()
      .populate('brand model category subCategory');

    // Filter by matching names
    const filtered = catalogImages.filter(ci =>
      ci.brand?.brandName === brand &&
      ci.model?.modelName === model &&
      ci.category?.categoryName === categoryTab &&
      ci.subCategory?.subCategoryName === subCategoryTab
    );

    // Flatten response
    const responseData = filtered.map(ci => ({
      catalogId: ci._id,
      brandId: ci.brand?._id || null,
      brandName: ci.brand?.brandName || null,
      modelId: ci.model?._id || null,
      modelName: ci.model?.modelName || null,
      categoryId: ci.category?._id || null,
      categoryName: ci.category?.categoryName || null,
      subCategoryId: ci.subCategory?._id || null,
      subCategoryName: ci.subCategory?.subCategoryName || null,
      images: ci.images,
      createdAt: ci.createdAt,
    }));

    res.status(200).json({ success: true, data: responseData });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch catalog images by names',
      error: error.message
    });
  }
};
