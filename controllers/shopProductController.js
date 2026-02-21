const ShopProduct = require('../models/ShopProduct');
const logger = require('../config/logger'); // ← only addition at top

exports.addShopProduct = async (req, res) => {
  try {
    const shopId = req.params.shopId;
    const { part, price, discountedPrice, stock } = req.body;

    if (!part) {
      return res.status(400).json({ success: false, message: "part is required" });
    }

    const product = await ShopProduct.findOneAndUpdate(
      { shopId, part },
      { $set: { price, discountedPrice, stock, isAvailable: true } },
      { new: true, upsert: true }
    );

    return res.json({ success: true, data: product });
  } catch (err) {
    logger.error('addShopProduct failed', { shopId: req.params.shopId, error: err.message, stack: err.stack }); // ← was missing before
    return res.status(400).json({ success: false, error: err.message });
  }
};

exports.getShopProducts = async (req, res) => {
  try {
    const shopId = req.params.shopId;
    const products = await ShopProduct.find({ shopId })
      .populate({
        path: 'part',
        populate: [
          { path: 'category',    select: 'categoryName' },
          { path: 'subCategory', select: 'subCategoryName' },
          {
            path: 'compatibleVehicleConfigs',
            populate: [
              { path: 'brand', select: 'brandName' },
              { path: 'model', select: 'modelName' }
            ]
          }
        ]
      });

    res.json({ success: true, data: products });
  } catch (err) {
    logger.error('getShopProducts failed', { shopId: req.params.shopId, error: err.message, stack: err.stack }); // ← was missing before
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.updateShopProduct = async (req, res) => {
  try {
    const allowedFields = ['price', 'discountedPrice', 'stock', 'isAvailable'];
    const updateData = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined && req.body[key] !== null) {
        updateData[key] = req.body[key];
      }
    }

    const updated = await ShopProduct.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }

    res.json({ success: true, data: updated });
  } catch (err) {
    logger.error('updateShopProduct failed', { id: req.params.id, error: err.message, stack: err.stack }); // ← was missing before
    res.status(400).json({ success: false, error: err.message });
  }
};

exports.deleteShopProduct = async (req, res) => {
  try {
    const updated = await ShopProduct.findByIdAndUpdate(
      req.params.id,
      { isAvailable: false },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }

    res.json({ success: true, message: 'Product deactivated', data: updated });
  } catch (err) {
    logger.error('deleteShopProduct failed', { id: req.params.id, error: err.message, stack: err.stack }); // ← was missing before
    res.status(500).json({ success: false, error: err.message });
  }
};