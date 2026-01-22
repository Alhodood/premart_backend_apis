const ShopProduct = require('../models/ShopProduct');
const mongoose = require('mongoose');

/**
 * GET all stock for a shop
 */
exports.getStockByShop = async (req, res) => {
  try {
    const { shopId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(shopId)) {
      return res.status(400).json({ success: false, message: 'Invalid shopId' });
    }

    const products = await ShopProduct.find({ shopId })
      .populate({
        path: 'part',
        select: 'partName partNumber images category',
        populate: { path: 'category', select: 'categoryName' }
      })
      .sort({ updatedAt: -1 });

    res.json({ success: true, count: products.length, data: products });

  } catch (err) {
    console.error('getStockByShop:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};


/**
 * GET stock of one product for a shop
 */
exports.getStockByProduct = async (req, res) => {
  try {
    const { shopId, productId } = req.params;

    const product = await ShopProduct.findOne({
      _id: productId,
      shopId
    }).populate('part');

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.json({ success: true, data: product });

  } catch (err) {
    console.error('getStockByProduct:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};


/**
 * SET stock directly
 */
exports.updateStock = async (req, res) => {
  try {
    const { stock } = req.body;

    if (typeof stock !== 'number' || stock < 0) {
      return res.status(400).json({ success: false, message: 'Invalid stock value' });
    }

    const updated = await ShopProduct.findByIdAndUpdate(
      req.params.productId,
      { stock },
      { new: true }
    ).populate('part');

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.json({ success: true, message: 'Stock updated', data: updated });

  } catch (err) {
    console.error('updateStock:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};


/**
 * ADJUST stock (+/-)
 */
exports.adjustStock = async (req, res) => {
  try {
    const { adjustment } = req.body;

    if (typeof adjustment !== 'number') {
      return res.status(400).json({ success: false, message: 'Adjustment must be number' });
    }

    const product = await ShopProduct.findById(req.params.productId);

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const newStock = product.stock + adjustment;

    if (newStock < 0) {
      return res.status(400).json({
        success: false,
        message: `Stock cannot go below 0. Current: ${product.stock}`
      });
    }

    product.stock = newStock;
    await product.save();

    res.json({ success: true, message: 'Stock adjusted', data: product });

  } catch (err) {
    console.error('adjustStock:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};


/**
 * LOW STOCK ALERT
 */
exports.getLowStock = async (req, res) => {
  try {
    const threshold = Number(req.query.threshold || 5);

    const products = await ShopProduct.find({
      shopId: req.params.shopId,
      stock: { $lte: threshold }
    }).populate('part');

    res.json({ success: true, count: products.length, data: products });

  } catch (err) {
    console.error('getLowStock:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};