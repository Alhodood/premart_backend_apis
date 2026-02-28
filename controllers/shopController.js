const mongoose = require('mongoose');
const { Shop } = require('../models/Shop');
const Order = require('../models/Order');
const logger = require('../config/logger'); // ← only addition at top

exports.createShop = async (req, res) => {
  try {
    const { shopeDetails } = req.body;

    if (!shopeDetails) {
      return res.status(400).json({ success: false, message: 'Shop details are required' });
    }

    const { shopName, shopAddress, shopMail, shopContact, shopLocation } = shopeDetails;

    if (!shopName || !shopAddress || !shopContact) {
      return res.status(400).json({ success: false, message: 'Shop name, address, and contact are required' });
    }

    if (!shopLocation || shopLocation.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Shop location is required',
        hint: 'Provide location in format: "latitude,longitude" (e.g., "25.2048,55.2708")'
      });
    }

    const locationParts = shopLocation.split(',');
    if (locationParts.length !== 2) {
      return res.status(400).json({
        success: false,
        message: 'Invalid shop location format',
        hint: 'Use format: "latitude,longitude" (e.g., "25.2048,55.2708")'
      });
    }

    const [lat, lng] = locationParts.map(num => parseFloat(num.trim()));

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ success: false, message: 'Shop location must contain valid numbers', received: shopLocation });
    }

    if (lat < 24 || lat > 26 || lng < 54 || lng > 56) {
      return res.status(400).json({
        success: false,
        message: 'Coordinates out of valid range for UAE',
        hint: 'UAE coordinates: latitude 24-26, longitude 54-56',
        received: `${lat}, ${lng}`
      });
    }

    const shop = new Shop({
      shopeDetails: { ...shopeDetails, shopLocation: `${lat},${lng}` }
    });
    await shop.save();

    return res.status(201).json({
      success: true,
      message: 'Shop created successfully',
      data: {
        _id: shop._id,
        shopName: shop.shopeDetails.shopName,
        shopAddress: shop.shopeDetails.shopAddress,
        shopLocation: shop.shopeDetails.shopLocation,
        createdAt: shop.createdAt
      }
    });
  } catch (err) {
    logger.error('createShop failed', { error: err.message, stack: err.stack }); // ← replaced console.error
    return res.status(500).json({ success: false, message: 'Failed to create shop', error: err.message });
  }
};

exports.getAllShops = async (req, res) => {
  try {
    const shops = await Shop.find().lean();

    const formattedShops = shops.map(shop => ({
      _id: shop._id,
      shopName:             shop.shopeDetails?.shopName,
      shopAddress:          shop.shopeDetails?.shopAddress,
      shopMail:             shop.shopeDetails?.shopMail,
      shopContact:          shop.shopeDetails?.shopContact,
      shopLicenseNumber:    shop.shopeDetails?.shopLicenseNumber,
      shopLicenseExpiry:    shop.shopeDetails?.shopLicenseExpiry,
      profileImage:         shop.shopeDetails?.profileImage, 
      shopLicenseImage:     shop.shopeDetails?.shopLicenseImage,
      EmiratesId:           shop.shopeDetails?.EmiratesId,
      EmiratesIdImage:      shop.shopeDetails?.EmiratesIdImage,
      taxRegistrationNumber: shop.shopeDetails?.taxRegistrationNumber,
      bankName:             shop.shopeDetails?.shopBankDetails?.bankName,
      accountNumber:        shop.shopeDetails?.shopBankDetails?.accountNumber,
      ibanNuber:            shop.shopeDetails?.shopBankDetails?.ibanNuber,
      branch:               shop.shopeDetails?.shopBankDetails?.branch,
      swiftCode:            shop.shopeDetails?.shopBankDetails?.swiftCode,
      supportMail:          shop.shopeDetails?.supportMail,
      supportNumber:        shop.shopeDetails?.supportNumber,
      termsAndCondition:    shop.shopeDetails?.termsAndCondition,
      orderCount:           shop.orders?.length || 0,
      productCount:         shop.products?.length || 0,
      shopLocation:         shop.shopeDetails?.shopLocation,
      isVerified:           shop.isVerified || false,
      createdAt:            shop.createdAt,
      updatedAt:            shop.updatedAt,
    }));

    res.status(200).json({ success: true, data: formattedShops, message: "Shops fetched successfully" });
  } catch (error) {
    logger.error('getAllShops failed', { error: error.message, stack: error.stack }); // ← replaced console.error
    res.status(500).json({ success: false, message: 'Server Error', data: [] });
  }
};

exports.getShopById = async (req, res) => {
  try {
    const shop = await Shop.findById(req.params.shopId);
    if (!shop) {
      return res.status(404).json({ success: false, message: 'Shop not found', data: [] });
    }
    res.status(200).json({ success: true, data: shop, message: "shop fetched successfully" });
  } catch (error) {
    logger.error('getShopById failed', { shopId: req.params.shopId, error: error.message, stack: error.stack }); // ← was missing before
    res.status(500).json({ success: false, message: 'Server Error', data: [] });
  }
};

exports.updateShop = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const updateQuery = {};
    if (updateData.shopeDetails) {
      Object.keys(updateData.shopeDetails).forEach(key => {
        if (key === 'shopBankDetails' && typeof updateData.shopeDetails[key] === 'object') {
          Object.keys(updateData.shopeDetails[key]).forEach(bankKey => {
            updateQuery[`shopeDetails.shopBankDetails.${bankKey}`] = updateData.shopeDetails[key][bankKey];
          });
        } else {
          updateQuery[`shopeDetails.${key}`] = updateData.shopeDetails[key];
        }
      });
    }

    const shop = await Shop.findByIdAndUpdate(
      id,
      { $set: updateQuery },
      { new: true, runValidators: true }
    );

    if (!shop) {
      return res.status(404).json({ success: false, message: 'Shop not found' });
    }

    res.status(200).json({ success: true, message: 'Shop updated successfully', data: shop });
  } catch (err) {
    logger.error('updateShop failed', { id: req.params.id, error: err.message, stack: err.stack }); // ← replaced console.error
    res.status(500).json({ success: false, message: 'Failed to update shop', error: err.message });
  }
};

exports.deleteShop = async (req, res) => {
  try {
    const deletedShop = await Shop.findByIdAndDelete(req.params.id);
    if (!deletedShop) {
      return res.status(404).json({ success: false, message: 'Shop not found', data: [] });
    }
    res.status(200).json({ success: true, message: 'Shop deleted successfully', data: deletedShop });
  } catch (error) {
    logger.error('deleteShop failed', { id: req.params.id, error: error.message, stack: error.stack }); // ← was missing before
    res.status(500).json({ success: false, message: 'Server Error', data: [] });
  }
};

exports.searchShopsForSuperAdmin = async (req, res) => {
  try {
    const { search, emiratesId, fromExpiry, toExpiry, page = 1, limit = 10, sortBy = 'createdAt', sort = 'desc' } = req.query;

    let filter = {};
    if (search) {
      filter.$or = [
        { 'shopeDetails.shopName':    { $regex: search, $options: 'i' } },
        { 'shopeDetails.shopMail':    { $regex: search, $options: 'i' } },
        { 'shopeDetails.shopContact': { $regex: search, $options: 'i' } }
      ];
    }
    if (emiratesId) filter['shopeDetails.EmiratesId'] = emiratesId;
    if (fromExpiry && toExpiry) {
      filter['shopeDetails.shopLicenseExpiry'] = { $gte: fromExpiry, $lte: toExpiry };
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
    logger.error('searchShopsForSuperAdmin failed', { query: req.query, error: error.message, stack: error.stack }); // ← replaced console.error
    res.status(500).json({ message: 'Failed to fetch shops', success: false, data: error.message });
  }
};

exports.shopConfirmReady = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { shopId } = req.body;

    if (!shopId) {
      return res.status(400).json({ message: 'shopId is required', success: false });
    }

    const order = await Order.findOne({ _id: orderId, shopId });
    if (!order) {
      return res.status(404).json({ message: 'Order not found or does not belong to this shop', success: false });
    }

    if (order.orderStatus !== 'Accepted by Delivery Boy') {
      return res.status(400).json({ message: `Cannot mark order as ready from current status: ${order.orderStatus}`, success: false });
    }

    order.orderStatus = 'Ready for Pickup';
    await order.save();

    return res.status(200).json({ message: 'Order marked as Ready for Pickup', success: true, data: order });
  } catch (error) {
    logger.error('shopConfirmReady failed', { orderId: req.params.orderId, error: error.message, stack: error.stack }); // ← replaced console.error
    return res.status(500).json({ message: 'Internal Server Error', success: false, error: error.message });
  }
};

exports.deleteShopById = async (req, res) => {
  const { shopId } = req.params;
  try {
    const objectId = new mongoose.Types.ObjectId(shopId);

    let shop = await Shop.findOneAndDelete({ _id: objectId });
    if (!shop) {
      shop = await Shop.findOneAndDelete({ 'shopeDetails._id': objectId });
    }

    if (!shop) {
      return res.status(404).json({ success: false, message: "Shop not found", data: [] });
    }

    return res.status(200).json({ success: true, message: "Shop deleted successfully", data: shop });
  } catch (error) {
    logger.error('deleteShopById failed', { shopId, error: error.message, stack: error.stack }); // ← replaced console.error
    return res.status(500).json({ success: false, message: "Error deleting shop", error: error.message });
  }
};