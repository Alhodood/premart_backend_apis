const ShopProduct = require('../models/ShopProduct');

exports.addShopProduct = async (req, res) => {
  try {
    const shopId = req.params.shopId;

    const product = await ShopProduct.create({
      ...req.body,
      shopId
    });

    res.status(201).json({ success: true, data: product });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

exports.getShopProducts = async (req, res) => {
  try {
    const shopId = req.params.shopId;

    const products = await ShopProduct.find({ shopId })
      .populate({
        path: 'part',
        populate: ['category', 'subCategory'] // PartsCatalog doesn't have brand/model directly
      });

    res.json({ success: true, data: products });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.updateShopProduct = async (req, res) => {
  try {
    const updated = await ShopProduct.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }

    res.json({ success: true, data: updated });
  } catch (err) {
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
    res.status(500).json({ success: false, error: err.message });
  }
};