const Coupon = require('../models/Coupon');
const Offer = require('../models/Offers');

exports.createCoupon = async (req, res) => {
  try {
    const { shopId, superAdminId, ...rest } = req.body;
    const coupon = new Coupon({ ...rest, shopId: shopId || null });
    await coupon.save();
    res.status(201).json({ message: 'Coupon created', success: true, data: coupon });
  } catch (err) {
    res.status(500).json({ message: 'Failed to create coupon', success: false, data: err.message });
  }
};

exports.getAllCoupons = async (req, res) => {
  try {
    const { shopId, superAdminId } = req.query;
    const filter = shopId ? { shopId } : {};
    const coupons = await Coupon.find(filter).sort({ createdAt: -1 });
    res.status(200).json({ message: 'Coupons fetched', success: true, data: coupons });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch coupons', success: false, data: err.message });
  }
};

exports.deleteCoupon = async (req, res) => {
  try {
    await Coupon.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Coupon deleted', success: true });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete coupon', success: false, data: err.message });
  }
};

// Offers
exports.createOffer = async (req, res) => {
  try {
    const { shopId, superAdminId, ...rest } = req.body;
    const offer = new Offer({ ...rest, shopId: shopId || null });
    await offer.save();
    res.status(201).json({ message: 'Offer created', success: true, data: offer });
  } catch (err) {
    res.status(500).json({ message: 'Failed to create offer', success: false, data: err.message });
  }
};

exports.getAllOffers = async (req, res) => {
  try {
    const { shopId, superAdminId } = req.query;
    const filter = shopId ? { shopId } : {};
    const offers = await Offer.find(filter).sort({ createdAt: -1 });
    res.status(200).json({ message: 'Offers fetched', success: true, data: offers });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch offers', success: false, data: err.message });
  }
};

exports.deleteOffer = async (req, res) => {
  try {
    await Offer.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Offer deleted', success: true });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete offer', success: false, data: err.message });
  }
};