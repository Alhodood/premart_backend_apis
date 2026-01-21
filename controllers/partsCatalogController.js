const PartsCatalog = require('../models/PartsCatalog');
const ShopProduct = require('../models/ShopProduct');
const SubCategory = require('../models/SubCategory');
const Engine = require('../models/Engine');
const Transmission = require('../models/Transmission');
const VehicleConfiguration = require('../models/VehicleConfiguration');
const mongoose = require('mongoose');

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

    console.log('📦 Create Part Request:', JSON.stringify(req.body, null, 2));

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
    console.log('✅ Part created:', part._id);

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
    console.error('❌ Create Part Error:', err);
    console.error('Error details:', err.message);
    console.error('Stack:', err.stack);
    res.status(500).json({ 
      success: false, 
      message: err.message,
      error: process.env.NODE_ENV === 'development' ? err.stack : undefined
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
    console.error('Get All Parts Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};



// GET PART BY ID - FIXED
exports.getPartById = async (req, res) => {
  try {
    const part = await PartsCatalog.findById(req.params.id)
      .populate('category', 'categoryName')
      .populate('subCategory', 'subCategoryName')
      .populate({
        path: 'compatibleVehicleConfigs',
        populate: {
          path: 'brand model',
          select: 'brandName modelName year engineType transmission'
        }
      });

    if (!part || !part.isActive) {
      return res.status(404).json({ success: false, message: 'Part not found' });
    }

    res.json({ success: true, data: part });

  } catch (err) {
    console.error('Get Part Error:', err);
    res.status(500).json({ success: false, error: err.message });
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
      vehicleConfig, // Direct vehicle config ID
      page = 1,
      limit = 20,
      minPrice,
      maxPrice,
      inStock
    } = req.query;

    const filter = { isActive: true };

    if (partNumber) filter.partNumber = new RegExp(partNumber, 'i');
    if (partName) filter.partName = new RegExp(partName, 'i');
    
    // Validate category is a valid ObjectId
    if (category) {
      if (mongoose.Types.ObjectId.isValid(category)) {
        filter.category = category;
      } else {
        return res.status(400).json({
          success: false,
          message: 'Invalid category ID format'
        });
      }
    }
    
    // Validate subCategory - handle both ObjectId and name (URL decoded)
    if (subCategory) {
      try {
        // Decode URL-encoded subcategory name (e.g., "Spark%20Plugs" -> "Spark Plugs")
        const decodedSubCategory = decodeURIComponent(String(subCategory));
        
        if (mongoose.Types.ObjectId.isValid(decodedSubCategory)) {
          // It's a valid ObjectId
          filter.subCategory = decodedSubCategory;
        } else {
          // It might be a subcategory name, try to find it
          const foundSubCategory = await SubCategory.findOne({
            subCategoryName: new RegExp(decodedSubCategory.trim(), 'i')
          }).select('_id');
          
          if (foundSubCategory) {
            filter.subCategory = foundSubCategory._id;
          } else {
            // Invalid subcategory, return empty results instead of error
            console.log(`⚠️ SubCategory not found: "${decodedSubCategory}"`);
            return res.json({
              success: true,
              count: 0,
              page: parseInt(page),
              limit: parseInt(limit),
              totalPages: 0,
              data: [],
              message: `No subcategory found matching: ${decodedSubCategory}`
            });
          }
        }
      } catch (subCatErr) {
        console.error('❌ SubCategory lookup error:', subCatErr);
        return res.status(500).json({
          success: false,
          message: 'Error looking up subcategory',
          error: subCatErr.message
        });
      }
    }

    // Handle vehicle config filtering
    // Priority: vehicleConfig (direct ID) > brand/model/year lookup
    let vehicleConfigIds = null;
    
    if (vehicleConfig) {
      // Direct vehicle config ID provided
      if (mongoose.Types.ObjectId.isValid(vehicleConfig)) {
        vehicleConfigIds = [vehicleConfig];
        filter.compatibleVehicleConfigs = { $in: vehicleConfigIds };
      } else {
        return res.status(400).json({
          success: false,
          message: 'Invalid vehicleConfig ID format'
        });
      }
    } else if (brand || model || year) {
      // Look up vehicle configs by brand/model/year
      const vehicleFilter = {};
      
      // Validate brand is a valid ObjectId
      if (brand) {
        if (mongoose.Types.ObjectId.isValid(brand)) {
          vehicleFilter.brand = brand;
        } else {
          return res.status(400).json({
            success: false,
            message: 'Invalid brand ID format'
          });
        }
      }
      
      // Validate model is a valid ObjectId
      if (model) {
        if (mongoose.Types.ObjectId.isValid(model)) {
          vehicleFilter.model = model;
        } else {
          return res.status(400).json({
            success: false,
            message: 'Invalid model ID format'
          });
        }
      }
      
      if (year) vehicleFilter.year = Number(year);
      
      try {
        const matchingConfigs = await VehicleConfiguration.find(vehicleFilter).select('_id');
        vehicleConfigIds = matchingConfigs.map(c => c._id);
        
        if (vehicleConfigIds.length > 0) {
          filter.compatibleVehicleConfigs = { $in: vehicleConfigIds };
        } else {
          // No matching configs found, return empty
          return res.json({ 
            success: true, 
            count: 0, 
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: 0,
            data: [],
            message: 'No vehicle configurations found matching the criteria'
          });
        }
      } catch (vehicleConfigErr) {
        console.error('VehicleConfig lookup error:', vehicleConfigErr);
        return res.status(500).json({
          success: false,
          message: 'Error looking up vehicle configurations',
          error: vehicleConfigErr.message
        });
      }
    }

    // Get parts matching the filter
    console.log('🔍 Search filter:', JSON.stringify(filter, null, 2));
    
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
    
    console.log(`✅ Found ${results.length} parts matching filter`);

    // If no parts found, return early
    if (results.length === 0) {
      return res.json({
        success: true,
        count: 0,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: 0,
        data: []
      });
    }

    // OPTIMIZED: Fetch all shop products for all parts in one query (avoid N+1 problem)
    const partIds = results.map(p => p._id);
    
    // Build shop product filter
    const shopProductFilter = {
      part: { $in: partIds },
      isAvailable: true
    };

    // Optional filters for shop products
    if (minPrice) shopProductFilter.price = { $gte: Number(minPrice) };
    if (maxPrice) {
      shopProductFilter.price = shopProductFilter.price || {};
      shopProductFilter.price.$lte = Number(maxPrice);
    }
    if (inStock === 'true') {
      shopProductFilter.stock = { $gt: 0 };
    }

    // Fetch all shop products for these parts in one query
    const allShopProducts = await ShopProduct.find(shopProductFilter)
      .populate({
        path: 'shopId',
        select: 'shopeDetails.shopName shopeDetails.shopAddress shopeDetails.shopLocation shopeDetails.shopContact shopeDetails.supportMail shopeDetails.supportNumber'
      })
      .sort({ price: 1 }); // Sort by price ascending

    // Group shop products by part ID
    const shopProductsByPart = {};
    allShopProducts.forEach(sp => {
      const partIdStr = sp.part.toString();
      if (!shopProductsByPart[partIdStr]) {
        shopProductsByPart[partIdStr] = [];
      }
      shopProductsByPart[partIdStr].push(sp);
    });

    // Map shops to each part
    const partsWithShops = results.map(part => {
      const shopProducts = shopProductsByPart[part._id.toString()] || [];
      
      // Format shop data
      const shops = shopProducts
        .filter(sp => sp.shopId) // Filter out null shops
        .map(sp => ({
          shopId: sp.shopId._id,
          shopProductId: sp._id, // Important for cart/order
          shopName: sp.shopId.shopeDetails?.shopName || 'Unknown Shop',
          shopAddress: sp.shopId.shopeDetails?.shopAddress || '',
          shopLocation: sp.shopId.shopeDetails?.shopLocation || '',
          shopContact: sp.shopId.shopeDetails?.shopContact || '',
          supportMail: sp.shopId.shopeDetails?.supportMail || '',
          supportNumber: sp.shopId.shopeDetails?.supportNumber || '',
          price: sp.price,
          discountedPrice: sp.discountedPrice,
          stock: sp.stock,
          isAvailable: sp.isAvailable,
          hasDiscount: !!sp.discountedPrice,
          finalPrice: sp.discountedPrice || sp.price
        }));

      return {
        ...part.toObject(),
        shops: shops,
        shopCount: shops.length,
        minPrice: shops.length > 0 ? Math.min(...shops.map(s => s.finalPrice)) : null,
        maxPrice: shops.length > 0 ? Math.max(...shops.map(s => s.finalPrice)) : null,
        inStock: shops.some(s => s.stock > 0)
      };
    });

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const totalCount = partsWithShops.length;
    const totalPages = Math.ceil(totalCount / limitNum);
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    const paginatedParts = partsWithShops.slice(startIndex, endIndex);

    res.json({
      success: true,
      count: totalCount,
      page: pageNum,
      limit: limitNum,
      totalPages: totalPages,
      data: paginatedParts
    });

  } catch (err) {
    console.error('Search Parts Error:', err);
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
    console.error('Deactivate Part Error:', err);
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
    console.error('Search By Part Number Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};