const mongoose = require('mongoose');
const { Shop } = require('../models/Shop');
const Order = require('../models/Order');

// Create a new shop
// controllers/shopController.js
// controllers/shopController.js



exports.createShop = async (req, res) => {
  try {
    const { shopeDetails } = req.body;

    // ✅ Validate required shop details
    if (!shopeDetails) {
      return res.status(400).json({
        success: false,
        message: 'Shop details are required'
      });
    }

    const {
      shopName,
      shopAddress,
      shopMail,
      shopContact,
      shopLocation  // ✅ This is critical
    } = shopeDetails;

    // ✅ Validate required fields
    if (!shopName || !shopAddress || !shopContact) {
      return res.status(400).json({
        success: false,
        message: 'Shop name, address, and contact are required'
      });
    }

    // ✅ CRITICAL: Validate shop location
    if (!shopLocation || shopLocation.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Shop location is required',
        hint: 'Provide location in format: "latitude,longitude" (e.g., "25.2048,55.2708")'
      });
    }

    // ✅ Validate location format
    const locationParts = shopLocation.split(',');
    if (locationParts.length !== 2) {
      return res.status(400).json({
        success: false,
        message: 'Invalid shop location format',
        hint: 'Use format: "latitude,longitude" (e.g., "25.2048,55.2708")'
      });
    }

    const [lat, lng] = locationParts.map(num => parseFloat(num.trim()));

    // ✅ Validate numbers
    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({
        success: false,
        message: 'Shop location must contain valid numbers',
        received: shopLocation
      });
    }

    // ✅ Validate range (for UAE/Dubai)
    if (lat < 24 || lat > 26 || lng < 54 || lng > 56) {
      return res.status(400).json({
        success: false,
        message: 'Coordinates out of valid range for UAE',
        hint: 'UAE coordinates: latitude 24-26, longitude 54-56',
        received: `${lat}, ${lng}`
      });
    }

    // ✅ Create shop with validated location
    const shop = new Shop({
      shopeDetails: {
        ...shopeDetails,
        shopLocation: `${lat},${lng}`  // ✅ Ensure proper format
      }
    });

    await shop.save();

    return res.status(201).json({
      success: true,
      message: 'Shop created successfully',
      data: {
        _id: shop._id,
        shopName: shop.shopeDetails.shopName,
        shopAddress: shop.shopeDetails.shopAddress,
        shopLocation: shop.shopeDetails.shopLocation,  // ✅ Confirm it's saved
        createdAt: shop.createdAt
      }
    });
  } catch (err) {
    console.error('Create Shop Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to create shop',
      error: err.message
    });
  }
};

exports.getAllShops = async (req, res) => {
  try {
    const shops = await Shop.find().lean();
    const formattedShops = shops.map(shop => {
      return {
        _id: shop._id,
        // ─── BASIC INFORMATION ───
        shopName: shop.shopeDetails?.shopName,
        shopAddress: shop.shopeDetails?.shopAddress,
        shopMail: shop.shopeDetails?.shopMail,
        shopContact: shop.shopeDetails?.shopContact,
        // ─── LICENSE INFORMATION ───
        shopLicenseNumber: shop.shopeDetails?.shopLicenseNumber,
        shopLicenseExpiry: shop.shopeDetails?.shopLicenseExpiry,
        shopLicenseImage: shop.shopeDetails?.shopLicenseImage,
        // ─── EMIRATES ID ───
        EmiratesId: shop.shopeDetails?.EmiratesId,
        EmiratesIdImage: shop.shopeDetails?.EmiratesIdImage,
        // ─── TAX INFORMATION ───
        taxRegistrationNumber: shop.shopeDetails?.taxRegistrationNumber,
        // ─── BANK DETAILS (FLATTENED) ───
        bankName: shop.shopeDetails?.shopBankDetails?.bankName,
        accountNumber: shop.shopeDetails?.shopBankDetails?.accountNumber,
        ibanNuber: shop.shopeDetails?.shopBankDetails?.ibanNuber,
        branch: shop.shopeDetails?.shopBankDetails?.branch,
        swiftCode: shop.shopeDetails?.shopBankDetails?.swiftCode,
        // ─── SUPPORT INFORMATION ───
        supportMail: shop.shopeDetails?.supportMail,
        supportNumber: shop.shopeDetails?.supportNumber,
        // ─── TERMS & CONDITIONS ───
        termsAndCondition: shop.shopeDetails?.termsAndCondition,
        // ─── STATISTICS ───
        orderCount: shop.orders?.length || 0,
        productCount: shop.products?.length || 0,
        shopLocation: shop.shopeDetails?.shopLocation,
        // ✅ VERIFICATION STATUS (ADD THIS)
        isVerified: shop.isVerified || false,
        // ─── TIMESTAMPS ───
        createdAt: shop.createdAt,
        updatedAt: shop.updatedAt,
      };
    });

    res.status(200).json({ 
      success: true, 
      data: formattedShops, 
      message: "Shops fetched successfully" 
    });
  } catch (error) {
    console.error('Error fetching shops:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server Error', 
      data: [] 
    });
  }
};

// Get shop by ID
exports.getShopById = async (req, res) => {
  try {
    const shop = await Shop.findById(req.params.shopId);
    if (!shop) {
      return res.status(404).json({ success: false, message: 'Shop not found' ,data:[]});
    }
    res.status(200).json({ success: true, data: shop , message:"shop featched successfuly"});
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error',data:[] });
  }
};

// Update shop by ID
// controllers/shopController.js
exports.updateShop = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    console.log('========== UPDATE SHOP REQUEST ==========');
    console.log('Shop ID:', id);
    console.log('Update Data:', JSON.stringify(updateData, null, 2));

    // ✅ Build MongoDB update query with dot notation for nested fields
    const updateQuery = {};

    if (updateData.shopeDetails) {
      Object.keys(updateData.shopeDetails).forEach(key => {
        if (key === 'shopBankDetails' && typeof updateData.shopeDetails[key] === 'object') {
          // ✅ Handle nested bank details with dot notation
          Object.keys(updateData.shopeDetails[key]).forEach(bankKey => {
            updateQuery[`shopeDetails.shopBankDetails.${bankKey}`] = updateData.shopeDetails[key][bankKey];
          });
        } else {
          // ✅ Handle regular fields with dot notation
          updateQuery[`shopeDetails.${key}`] = updateData.shopeDetails[key];
        }
      });
    }

    console.log('MongoDB Update Query:', JSON.stringify(updateQuery, null, 2));

    // ✅ Use $set with dot notation to update specific fields only
    const shop = await Shop.findByIdAndUpdate(
      id,
      { $set: updateQuery },
      { 
        new: true,  // Return updated document
        runValidators: true  // Run schema validators
      }
    );

    if (!shop) {
      return res.status(404).json({
        success: false,
        message: 'Shop not found'
      });
    }

    console.log('✅ Shop updated successfully');
    console.log('Updated shop:', JSON.stringify(shop, null, 2));

    res.status(200).json({
      success: true,
      message: 'Shop updated successfully',
      data: shop
    });
  } catch (err) {
    console.error('========== UPDATE SHOP ERROR ==========');
    console.error('Error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to update shop',
      error: err.message
    });
  }
};

// Delete shop by ID
exports.deleteShop = async (req, res) => {
  try {
    const deletedShop = await Shop.findByIdAndDelete(req.params.id);
    if (!deletedShop) {
      return res.status(404).json({ success: false, message: 'Shop not found',data:[] });
    }
    res.status(200).json({ success: true, message: 'Shop deleted successfully' ,data:deletedShop});
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error',data:[] });
  }
};



exports.searchShopsForSuperAdmin = async (req, res) => {
  try {
    const {
      search,
      emiratesId,
      fromExpiry,
      toExpiry,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sort = 'desc'
    } = req.query;

    let filter = {};

    // Text search
    if (search) {
      filter.$or = [
        { 'shopeDetails.shopName': { $regex: search, $options: 'i' } },
        { 'shopeDetails.shopMail': { $regex: search, $options: 'i' } },
        { 'shopeDetails.shopContact': { $regex: search, $options: 'i' } }
      ];
    }

    // Emirates ID filter
    if (emiratesId) {
      filter['shopeDetails.EmiratesId'] = emiratesId;
    }

    // License Expiry filter
    if (fromExpiry && toExpiry) {
      filter['shopeDetails.shopLicenseExpiry'] = {
        $gte: fromExpiry,
        $lte: toExpiry
      };
    }

    const shops = await Shop.find(filter)
      .sort({ [sortBy]: sort === 'asc' ? 1 : -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Shop.countDocuments(filter);

    return res.status(200).json({
      message: 'Filtered shops fetched successfully',
      success: true,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      data: shops
    });

  } catch (error) {
    console.error('Shop Filter Error:', error);
    res.status(500).json({
      message: 'Failed to fetch shops',
      success: false,
      data: error.message
    });
  }
};



exports.shopConfirmReady = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { shopId } = req.body;

    if (!shopId) {
      return res.status(400).json({
        message: 'shopId is required',
        success: false
      });
    }

    const order = await Order.findOne({ _id: orderId, shopId });

    if (!order) {
      return res.status(404).json({
        message: 'Order not found or does not belong to this shop',
        success: false
      });
    }

    if (order.orderStatus !== 'Accepted by Delivery Boy') {
      return res.status(400).json({
        message: `Cannot mark order as ready from current status: ${order.orderStatus}`,
        success: false
      });
    }

    order.orderStatus = 'Ready for Pickup';
    await order.save();

    return res.status(200).json({
      message: 'Order marked as Ready for Pickup',
      success: true,
      data: order
    });

  } catch (error) {
    console.error('Vendor Confirm Ready Error:', error);
    return res.status(500).json({
      message: 'Internal Server Error',
      success: false,
      error: error.message
    });
  }
};
// Delete shop by ID using DELETE method and req.params.shopId
exports.deleteShopById = async (req, res) => {
  const { shopId } = req.params;
  try {
    console.log('Received shopId:', shopId);

    const objectId = new mongoose.Types.ObjectId(shopId);
    console.log('Converted to ObjectId:', objectId);

    // Try deleting by root _id
    let shop = await Shop.findOneAndDelete({ _id: objectId });
    console.log('Attempt to delete by _id:', shop);

    // If not found, try deleting by nested shopeDetails._id
    if (!shop) {
      shop = await Shop.findOneAndDelete({ 'shopeDetails._id': objectId });
      console.log('Attempt to delete by shopeDetails._id:', shop);
    }

    if (!shop) {
      return res.status(404).json({
        success: false,
        message: "Shop not found",
        data: []
      });
    }

    return res.status(200).json({
      success: true,
      message: "Shop deleted successfully",
      data: shop
    });

  } catch (error) {
    console.error('Delete Shop Error:', error);
    return res.status(500).json({
      success: false,
      message: "Error deleting shop",
      error: error.message
    });
  }
};