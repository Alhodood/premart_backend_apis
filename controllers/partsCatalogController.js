const PartsCatalog = require('../models/PartsCatalog');
const ShopProduct = require('../models/ShopProduct');
const SubCategory = require('../models/SubCategory');
const Engine = require('../models/Engine');
const Transmission = require('../models/Transmission');
const VehicleConfiguration = require('../models/VehicleConfiguration');
const mongoose = require('mongoose');
const logger = require('../config/logger'); // ← Winston logger

// CREATE PART
exports.createPart = async (req, res) => {
  try {
    const {
      partNumber,
      partName,
      category,
      subCategory,
      compatibleVehicleConfigs
    } = req.body;

    logger.info('📦 Create Part Request: ' + JSON.stringify(req.body, null, 2));

    if (!partNumber || !partName || !category) {
      return res.status(400).json({
        success: false,
        message: 'partNumber, partName, category are required'
      });
    }

    // Validate category is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(category)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category ID format'
      });
    }

    // Validate subCategory if provided
    let subCategoryId = null;
    if (subCategory) {
      if (mongoose.Types.ObjectId.isValid(subCategory)) {
        // It's a valid ObjectId
        subCategoryId = subCategory;

        // Verify subCategory exists
        const subCatExists = await SubCategory.findById(subCategoryId);
        if (!subCatExists) {
          return res.status(400).json({
            success: false,
            message: 'SubCategory not found'
          });
        }
      } else {
        // It might be a subcategory name, try to find it
        const foundSubCategory = await SubCategory.findOne({
          subCategoryName: new RegExp(String(subCategory).trim(), 'i')
        }).select('_id');

        if (foundSubCategory) {
          subCategoryId = foundSubCategory._id;
        } else {
          return res.status(400).json({
            success: false,
            message: `SubCategory "${subCategory}" not found. Please provide a valid subCategory ID or name.`
          });
        }
      }
    }

    const existing = await PartsCatalog.findOne({ partNumber });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Part with this partNumber already exists'
      });
    }

    // Validate vehicle config IDs if provided
    if (compatibleVehicleConfigs?.length) {
      const validCount = await VehicleConfiguration.countDocuments({
        _id: { $in: compatibleVehicleConfigs }
      });

      if (validCount !== compatibleVehicleConfigs.length) {
        return res.status(400).json({
          success: false,
          message: 'One or more invalid vehicleConfiguration IDs'
        });
      }
    }

    // Prepare part data with validated subCategory
    const partData = {
      ...req.body,
      category,
      subCategory: subCategoryId // Use validated subCategory ID
    };

    // Create the part
    const part = await PartsCatalog.create(partData);
    logger.info('✅ Part created: ' + part._id);

    // Populate the response
    const populated = await PartsCatalog.findById(part._id)
      .populate({
        path: 'compatibleVehicleConfigs',
        populate: {
          path: 'brand model',
          select: 'brandName modelName'
        }
      })
      .populate('category', 'categoryName')
      .populate('subCategory', 'subCategoryName');

    res.status(201).json({ success: true, data: populated });

  } catch (err) {
    logger.error('❌ Create Part Error: ' + err.message, { stack: err.stack });
    res.status(500).json({
      success: false,
      message: err.message,
      error: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
};

// UPDATE PART - NEW ENDPOINT
exports.updatePart = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    logger.info('🔄 Update Part Request');
    logger.info('📋 Part ID: ' + id);
    logger.info('📦 Update Data: ' + JSON.stringify(updateData, null, 2));

    // Validate part ID
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Part ID is required'
      });
    }

    // Check if part exists
    const existingPart = await PartsCatalog.findById(id);
    if (!existingPart) {
      logger.warn('❌ Part not found with ID: ' + id);
      return res.status(404).json({
        success: false,
        message: 'Part not found'
      });
    }

    logger.info('✅ Found existing part: ' + existingPart.partNumber);

    // If partNumber is being updated, check for duplicates
    if (updateData.partNumber && updateData.partNumber !== existingPart.partNumber) {
      const duplicate = await PartsCatalog.findOne({
        partNumber: updateData.partNumber,
        _id: { $ne: id }
      });

      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: 'Part with this part number already exists'
        });
      }
    }

    // Validate vehicle config IDs if provided
    if (updateData.compatibleVehicleConfigs && Array.isArray(updateData.compatibleVehicleConfigs)) {
      if (updateData.compatibleVehicleConfigs.length > 0) {
        const validCount = await VehicleConfiguration.countDocuments({
          _id: { $in: updateData.compatibleVehicleConfigs }
        });

        if (validCount !== updateData.compatibleVehicleConfigs.length) {
          return res.status(400).json({
            success: false,
            message: 'One or more invalid vehicle configuration IDs'
          });
        }
        logger.info('✅ Validated vehicle configurations');
      }
    }

    // Update the part
    const updatedPart = await PartsCatalog.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('category', 'categoryName')
      .populate('subCategory', 'subCategoryName')
      .populate({
        path: 'compatibleVehicleConfigs',
        populate: {
          path: 'brand model',
          select: 'brandName modelName year engineType transmission'
        }
      });

    if (!updatedPart) {
      return res.status(404).json({
        success: false,
        message: 'Failed to update part'
      });
    }

    logger.info('✅ Part updated successfully: ' + updatedPart._id);

    res.json({
      success: true,
      message: 'Part updated successfully',
      data: updatedPart
    });

  } catch (err) {
    logger.error('❌ Update Part Error: ' + err.message, { stack: err.stack });
    res.status(500).json({
      success: false,
      message: 'Failed to update part',
      error: err.message
    });
  }
};

// GET ALL PARTS - FIXED
exports.getAllParts = async (req, res) => {
  try {
    const parts = await PartsCatalog.find({ isActive: true })
      .populate('category', 'categoryName')
      .populate('subCategory', 'subCategoryName')
      .populate({
        path: 'compatibleVehicleConfigs',
        populate: {
          path: 'brand model',
          select: 'brandName modelName'
        }
      })
      .sort({ createdAt: -1 });

    res.json({ success: true, count: parts.length, data: parts });

  } catch (err) {
    logger.error('Get All Parts Error: ' + err.message, { stack: err.stack });
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET PART BY ID - FIXED
// GET PART BY ID (WITH SHOP PROFILE IMAGE)
exports.getPartById = async (req, res) => {
  try {
    const { id } = req.params;

    // 1️⃣ Fetch Part With Required Populations
    const part = await PartsCatalog.findById(id)
      .populate('category', 'categoryName')
      .populate('subCategory', 'subCategoryName')
      .populate({
        path: 'compatibleVehicleConfigs',
        populate: {
          path: 'brand model',
          select: 'brandName modelName'
        }
      });

    if (!part || !part.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Part not found'
      });
    }

    // 2️⃣ Fetch Shop Products For This Part
    const shopProducts = await ShopProduct.find({
      part: id,
      isAvailable: true
    }).populate({
      path: 'shopId',
      select: `
        shopeDetails.shopName
        shopeDetails.shopAddress
        shopeDetails.shopContact
        shopeDetails.shopLocation
        shopeDetails.supportMail
        shopeDetails.supportNumber
        shopeDetails.profileImage
      `
    });

    // 3️⃣ Format Shops Response
    const shops = shopProducts.map(sp => {
      const shopDetails = sp.shopId?.shopeDetails || {};

      return {
        shopProductId: sp._id,
        shopId: sp.shopId?._id || null,

        shopName: shopDetails.shopName || '',
        shopAddress: shopDetails.shopAddress || '',
        shopContact: shopDetails.shopContact || '',
        shopLocation: shopDetails.shopLocation || '',
        supportMail: shopDetails.supportMail || '',
        supportNumber: shopDetails.supportNumber || '',

        // ✅ NEW: Profile Image
        profileImage: shopDetails.profileImage || null,

        price: sp.price,
        discountedPrice: sp.discountedPrice,
        finalPrice: sp.discountedPrice ?? sp.price,
        stock: sp.stock,
        isAvailable: sp.isAvailable,
        hasDiscount:
          sp.discountedPrice !== null &&
          sp.discountedPrice < sp.price
      };
    });

    // 4️⃣ Price Calculations
    const minPrice =
      shops.length > 0
        ? Math.min(...shops.map(s => s.finalPrice))
        : null;

    const maxPrice =
      shops.length > 0
        ? Math.max(...shops.map(s => s.finalPrice))
        : null;

    const inStock = shops.some(s => s.stock > 0);

    // 5️⃣ Final Response
    return res.status(200).json({
      success: true,
      data: {
        ...part.toObject(),
        shops,
        shopCount: shops.length,
        minPrice,
        maxPrice,
        inStock
      }
    });

  } catch (error) {
    logger.error('Get Part Error:', {
      message: error.message,
      stack: error.stack
    });

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// ADVANCED SEARCH - ENHANCED WITH SHOPS
exports.searchParts = async (req, res) => {
  try {
    const {
      partNumber,
      partName,
      category,
      subCategory,
      brand,
      model,
      year,
      vehicleConfig,
      page = 1,
      limit = 20,
      minPrice,
      maxPrice,
      inStock
    } = req.query;

    const filter = { isActive: true };

    if (partNumber) filter.partNumber = new RegExp(partNumber, 'i');
    if (partName) filter.partName = new RegExp(partName, 'i');

    if (category) {
      if (mongoose.Types.ObjectId.isValid(category)) {
        filter.category = category;
      } else {
        return res.status(400).json({ success: false, message: 'Invalid category ID format' });
      }
    }

    if (subCategory) {
      try {
        const decodedSubCategory = decodeURIComponent(String(subCategory));

        if (mongoose.Types.ObjectId.isValid(decodedSubCategory)) {
          filter.subCategory = decodedSubCategory;
        } else {
          const foundSubCategory = await SubCategory.findOne({
            subCategoryName: new RegExp(decodedSubCategory.trim(), 'i')
          }).select('_id');

          if (foundSubCategory) {
            filter.subCategory = foundSubCategory._id;
          } else {
            logger.warn(`⚠️ SubCategory not found: "${decodedSubCategory}"`);
            return res.json({
              success: true, count: 0, page: parseInt(page),
              limit: parseInt(limit), totalPages: 0, data: [],
              message: `No subcategory found matching: ${decodedSubCategory}`
            });
          }
        }
      } catch (subCatErr) {
        logger.error('❌ SubCategory lookup error: ' + subCatErr.message, { stack: subCatErr.stack });
        return res.status(500).json({ success: false, message: 'Error looking up subcategory', error: subCatErr.message });
      }
    }

    let vehicleConfigIds = null;

    if (vehicleConfig) {
      if (mongoose.Types.ObjectId.isValid(vehicleConfig)) {
        vehicleConfigIds = [vehicleConfig];
        filter.compatibleVehicleConfigs = { $in: vehicleConfigIds };
      } else {
        return res.status(400).json({ success: false, message: 'Invalid vehicleConfig ID format' });
      }
    } else if (brand || model || year) {
      const vehicleFilter = {};

      if (brand) {
        if (mongoose.Types.ObjectId.isValid(brand)) {
          vehicleFilter.brand = brand;
        } else {
          return res.status(400).json({ success: false, message: 'Invalid brand ID format' });
        }
      }

      if (model) {
        if (mongoose.Types.ObjectId.isValid(model)) {
          vehicleFilter.model = model;
        } else {
          return res.status(400).json({ success: false, message: 'Invalid model ID format' });
        }
      }

      if (year) vehicleFilter.year = Number(year);

      try {
        const matchingConfigs = await VehicleConfiguration.find(vehicleFilter).select('_id');
        vehicleConfigIds = matchingConfigs.map(c => c._id);

        if (vehicleConfigIds.length > 0) {
          filter.compatibleVehicleConfigs = { $in: vehicleConfigIds };
        } else {
          return res.json({
            success: true, count: 0, page: parseInt(page),
            limit: parseInt(limit), totalPages: 0, data: [],
            message: 'No vehicle configurations found matching the criteria'
          });
        }
      } catch (vehicleConfigErr) {
        logger.error('VehicleConfig lookup error: ' + vehicleConfigErr.message, { stack: vehicleConfigErr.stack });
        return res.status(500).json({ success: false, message: 'Error looking up vehicle configurations', error: vehicleConfigErr.message });
      }
    }

    logger.info('🔍 Search filter: ' + JSON.stringify(filter, null, 2));

    const results = await PartsCatalog.find(filter)
      .populate('category', 'categoryName categoryImage')
      .populate('subCategory', 'subCategoryName subCategoryImage')
      .populate({
        path: 'compatibleVehicleConfigs',
        populate: {
          path: 'brand model',
          select: 'brandName modelName year engineType transmission'
        }
      })
      .sort({ createdAt: -1 });

    logger.info(`✅ Found ${results.length} parts matching filter`);

    if (results.length === 0) {
      return res.json({
        success: true, count: 0, page: parseInt(page),
        limit: parseInt(limit), totalPages: 0, data: []
      });
    }

    const partIds = results.map(p => p._id);

    const shopProductFilter = { part: { $in: partIds }, isAvailable: true };

    if (minPrice) shopProductFilter.price = { $gte: Number(minPrice) };
    if (maxPrice) {
      shopProductFilter.price = shopProductFilter.price || {};
      shopProductFilter.price.$lte = Number(maxPrice);
    }
    if (inStock === 'true') shopProductFilter.stock = { $gt: 0 };

    // ── CHANGE 1: added profileImage to the select ────────────────────────
    const allShopProducts = await ShopProduct.find(shopProductFilter)
      .populate({
        path: 'shopId',
        select: 'shopeDetails.shopName shopeDetails.shopAddress shopeDetails.shopLocation shopeDetails.shopContact shopeDetails.supportMail shopeDetails.supportNumber shopeDetails.profileImage'
      })
      .sort({ price: 1 });

    const shopProductsByPart = {};
    allShopProducts.forEach(sp => {
      const partIdStr = sp.part.toString();
      if (!shopProductsByPart[partIdStr]) shopProductsByPart[partIdStr] = [];
      shopProductsByPart[partIdStr].push(sp);
    });

    const partsWithShops = results.map(part => {
      const shopProducts = shopProductsByPart[part._id.toString()] || [];

      const shops = shopProducts
        .filter(sp => sp.shopId)
        .map(sp => ({
          shopId:          sp.shopId._id,
          shopProductId:   sp._id,
          shopName:        sp.shopId.shopeDetails?.shopName        || 'Unknown Shop',
          shopAddress:     sp.shopId.shopeDetails?.shopAddress     || '',
          shopLocation:    sp.shopId.shopeDetails?.shopLocation    || '',
          shopContact:     sp.shopId.shopeDetails?.shopContact     || '',
          supportMail:     sp.shopId.shopeDetails?.supportMail     || '',
          supportNumber:   sp.shopId.shopeDetails?.supportNumber   || '',
          // ── CHANGE 2: include profileImage in response ────────────────
          profileImage:    sp.shopId.shopeDetails?.profileImage    || null,
          price:           sp.price,
          discountedPrice: sp.discountedPrice,
          stock:           sp.stock,
          isAvailable:     sp.isAvailable,
          hasDiscount:     !!sp.discountedPrice,
          finalPrice:      sp.discountedPrice || sp.price
        }));

      return {
        ...part.toObject(),
        shops,
        shopCount: shops.length,
        minPrice:  shops.length > 0 ? Math.min(...shops.map(s => s.finalPrice)) : null,
        maxPrice:  shops.length > 0 ? Math.max(...shops.map(s => s.finalPrice)) : null,
        inStock:   shops.some(s => s.stock > 0)
      };
    });

    const pageNum    = parseInt(page);
    const limitNum   = parseInt(limit);
    const totalCount = partsWithShops.length;
    const totalPages = Math.ceil(totalCount / limitNum);
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedParts = partsWithShops.slice(startIndex, startIndex + limitNum);

    res.json({
      success: true,
      count: totalCount,
      page: pageNum,
      limit: limitNum,
      totalPages,
      data: paginatedParts
    });

  } catch (err) {
    logger.error('Search Parts Error: ' + err.message, { stack: err.stack });
    res.status(500).json({ success: false, error: err.message });
  }
};

// SOFT DELETE
exports.deactivatePart = async (req, res) => {
  try {
    const part = await PartsCatalog.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    )
      .populate('category', 'categoryName')
      .populate('subCategory', 'subCategoryName');

    if (!part) {
      return res.status(404).json({ success: false, message: 'Part not found' });
    }

    res.json({ success: true, data: part });

  } catch (err) {
    logger.error('Deactivate Part Error: ' + err.message, { stack: err.stack });
    res.status(500).json({ success: false, error: err.message });
  }
};

// SEARCH BY PART NUMBER - WITH SHOP INFORMATION
exports.searchByPartNumber = async (req, res) => {
  try {
    const { partNumber, page = 1, limit = 20 } = req.query;

    if (!partNumber) {
      return res.status(400).json({
        success: false,
        message: 'Part number is required'
      });
    }

    // Normalize part number (trim, uppercase)
    const normalizedPartNumber = partNumber.trim().toUpperCase();

    // Search for parts matching the part number (exact or partial match)
    const filter = {
      isActive: true,
      partNumber: new RegExp(normalizedPartNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Find parts matching the part number
    const parts = await PartsCatalog.find(filter)
      .populate('category', 'categoryName')
      .populate('subCategory', 'subCategoryName')
      .populate({
        path: 'compatibleVehicleConfigs',
        populate: {
          path: 'brand model',
          select: 'brandName modelName year engineType transmission'
        }
      })
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ partNumber: 1 });

    const total = await PartsCatalog.countDocuments(filter);
    const partIds = parts.map(p => p._id);

    // Fetch all shop products for these parts in a single query
    const shopProducts = await ShopProduct.find({
      part: { $in: partIds },
      isAvailable: true
    }).populate('shopId', 'shopeDetails');

    // Group shop products by part ID
    const shopProductsByPart = {};
    shopProducts.forEach(sp => {
      const partId = sp.part.toString();
      if (!shopProductsByPart[partId]) {
        shopProductsByPart[partId] = [];
      }
      shopProductsByPart[partId].push(sp);
    });

    // Format response with shop information
    const formattedParts = parts.map(part => {
      const partShopProducts = shopProductsByPart[part._id.toString()] || [];

      // Calculate price range and stock status
      const prices = partShopProducts.map(sp => sp.discountedPrice || sp.price);
      const minPrice = prices.length > 0 ? Math.min(...prices) : null;
      const maxPrice = prices.length > 0 ? Math.max(...prices) : null;
      const inStock = partShopProducts.some(sp => sp.stock > 0);

      // Format shops array
      const shops = partShopProducts.map(sp => {
        const shop = sp.shopId;
        const shopDetails = shop?.shopeDetails || {};
        return {
          shopId: shop?._id || null,
          shopProductId: sp._id,
          shopName: shopDetails.shopName || null,
          shopAddress: shopDetails.shopAddress || null,
          shopContact: shopDetails.shopContact || null,
          shopMail: shopDetails.shopMail || null,
          shopLocation: shopDetails.shopLocation || null,
          price: sp.price,
          discountedPrice: sp.discountedPrice || null,
          stock: sp.stock || 0,
          isAvailable: sp.isAvailable,
          hasDiscount: sp.discountedPrice !== null && sp.discountedPrice < sp.price,
          finalPrice: sp.discountedPrice || sp.price
        };
      });

      return {
        _id: part._id,
        partNumber: part.partNumber,
        partName: part.partName,
        description: part.description,
        category: part.category,
        subCategory: part.subCategory,
        compatibleVehicleConfigs: part.compatibleVehicleConfigs,
        images: part.images,
        madeIn: part.madeIn,
        weight: part.weight,
        dimensions: part.dimensions,
        oemNumber: part.oemNumber,
        warranty: part.warranty,
        isActive: part.isActive,
        shops: shops,
        shopCount: shops.length,
        minPrice: minPrice,
        maxPrice: maxPrice,
        inStock: inStock
      };
    });

    res.json({
      success: true,
      count: formattedParts.length,
      total: total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
      data: formattedParts
    });

  } catch (err) {
    logger.error('Search By Part Number Error: ' + err.message, { stack: err.stack });
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getProductDetailsByProductId = async (req, res) => {
  try {
    const { productId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid productId'
      });
    }

    // 1. Get product
    const product = await PartsCatalog.findById(productId)
      .populate('category', 'categoryName categoryImage')
      .populate('subCategory', 'subCategoryName subCategoryImage')
      .populate({
        path: 'compatibleVehicleConfigs',
        populate: [
          { path: 'brand', select: 'brandName' },
          { path: 'model', select: 'modelName' }
        ]
      });

    if (!product || !product.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // 2. Get all shop products for this product
    const shopProducts = await ShopProduct.find({
      part: productId,
      isAvailable: true
    }).populate({
      path: 'shopId',
      select: 'shopeDetails.shopName shopeDetails.shopAddress shopeDetails.shopContact shopeDetails.shopLocation shopeDetails.supportMail shopeDetails.supportNumber'
    });

    // 3. Format shops
    const shops = shopProducts.map(sp => {
      const shop = sp.shopId?.shopeDetails || {};
      return {
        shopProductId: sp._id,
        shopId: sp.shopId?._id,
        shopName: shop.shopName || '',
        shopAddress: shop.shopAddress || '',
        shopContact: shop.shopContact || '',
        shopLocation: shop.shopLocation || '',
        supportMail: shop.supportMail || '',
        supportNumber: shop.supportNumber || '',
        price: sp.price,
        discountedPrice: sp.discountedPrice,
        finalPrice: sp.discountedPrice || sp.price,
        stock: sp.stock,
        isAvailable: sp.isAvailable
      };
    });

    // 4. Final response
    res.json({
      success: true,
      data: {
        product,
        shops,
        shopCount: shops.length,
        minPrice: shops.length ? Math.min(...shops.map(s => s.finalPrice)) : null,
        maxPrice: shops.length ? Math.max(...shops.map(s => s.finalPrice)) : null,
        inStock: shops.some(s => s.stock > 0)
      }
    });

  } catch (err) {
    logger.error('Product details error: ' + err.message, { stack: err.stack });
    res.status(500).json({ success: false, error: err.message });
  }
};

// DELETE PART (SOFT DELETE)
exports.deletePart = async (req, res) => {
  try {
    const { id } = req.params;

    logger.info('🗑️ Delete Part Request');
    logger.info('📋 Part ID: ' + id);

    // Validate part ID
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid part ID'
      });
    }

    // Check if part exists
    const part = await PartsCatalog.findById(id);
    if (!part) {
      logger.warn('❌ Part not found with ID: ' + id);
      return res.status(404).json({
        success: false,
        message: 'Part not found'
      });
    }

    logger.info('✅ Found part: ' + part.partNumber);

    // Check if part is used in any shop products
    const shopProductCount = await ShopProduct.countDocuments({
      part: id,
      isAvailable: true
    });

    if (shopProductCount > 0) {
      logger.warn(`⚠️ Part is used in ${shopProductCount} shop products`);
      return res.status(400).json({
        success: false,
        message: `Cannot delete part. It is currently being used in ${shopProductCount} shop product(s). Please remove or deactivate those products first.`,
        shopProductCount: shopProductCount
      });
    }

    // Soft delete: Set isActive to false
    const deletedPart = await PartsCatalog.findByIdAndUpdate(
      id,
      {
        isActive: false,
        deletedAt: new Date()
      },
      { new: true }
    );

    if (!deletedPart) {
      return res.status(404).json({
        success: false,
        message: 'Failed to delete part'
      });
    }

    logger.info('✅ Part soft deleted successfully: ' + deletedPart._id);

    res.json({
      success: true,
      message: 'Part deleted successfully',
      data: {
        _id: deletedPart._id,
        partNumber: deletedPart.partNumber,
        partName: deletedPart.partName,
        isActive: deletedPart.isActive
      }
    });

  } catch (err) {
    logger.error('❌ Delete Part Error: ' + err.message, { stack: err.stack });
    res.status(500).json({
      success: false,
      message: 'Failed to delete part',
      error: err.message
    });
  }
};

// HARD DELETE (PERMANENT DELETE) - USE WITH CAUTION
exports.permanentDeletePart = async (req, res) => {
  try {
    const { id } = req.params;

    logger.info('🗑️ PERMANENT Delete Part Request');
    logger.info('📋 Part ID: ' + id);

    // Validate part ID
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid part ID'
      });
    }

    // Check if part exists
    const part = await PartsCatalog.findById(id);
    if (!part) {
      return res.status(404).json({
        success: false,
        message: 'Part not found'
      });
    }

    // Check if part is used in any shop products
    const shopProductCount = await ShopProduct.countDocuments({
      part: id
    });

    if (shopProductCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot permanently delete part. It is referenced in ${shopProductCount} shop product(s).`,
        shopProductCount: shopProductCount
      });
    }

    // Permanently delete the part
    await PartsCatalog.findByIdAndDelete(id);

    logger.info('✅ Part permanently deleted: ' + part.partNumber);

    res.json({
      success: true,
      message: 'Part permanently deleted',
      data: {
        _id: part._id,
        partNumber: part.partNumber,
        partName: part.partName
      }
    });

  } catch (err) {
    logger.error('❌ Permanent Delete Part Error: ' + err.message, { stack: err.stack });
    res.status(500).json({
      success: false,
      message: 'Failed to permanently delete part',
      error: err.message
    });
  }
};