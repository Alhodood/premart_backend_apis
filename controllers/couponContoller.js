const Coupon = require('../models/Coupon');
const logger = require('../config/logger');

// Create a new coupon under a shop
exports.createCoupon = async (req, res) => {
  try {
    logger.info('createCoupon: request received', { body: req.body });

    const { startDate, ...couponData } = req.body;
    couponData.startDate = startDate ? new Date(startDate) : new Date();

    const newCoupon = new Coupon(couponData);
    const saved = await newCoupon.save();

    logger.info('createCoupon: coupon created successfully', { id: saved._id });
    res.status(201).json({ data: saved, success: true, message: "coupon created successfully" });
  } catch (err) {
    logger.error('createCoupon: failed to create coupon', { error: err });
    res.status(400).json({ data: [], success: false, message: err.message });
  }
};

// Get all coupons
exports.getAllCoupons = async (req, res) => {
  try {
    logger.info('getAllCoupons: request received');

    const coupons = await Coupon.find();

    logger.info('getAllCoupons: coupons fetched successfully', { count: coupons.length });
    res.status(200).json({ success: true, message: "coupon featched succcessfuly", data: coupons });
  } catch (err) {
    logger.error('getAllCoupons: failed to fetch coupons', { error: err });
    res.status(500).json({ message: err.message, success: false, data: [] });
  }
};

exports.getCouponById = async (req, res) => {
  try {
    const couponId = req.params.id;
    logger.info('getCouponById: request received', { couponId });

    const coupon = await Coupon.findById(couponId);
    if (!coupon) {
      logger.warn('getCouponById: coupon not found', { couponId });
      return res.status(404).json({ message: 'Coupon not found', success: false, data: [] });
    }

    logger.info('getCouponById: coupon fetched successfully', { couponId });
    res.status(200).json({ message: 'Coupon fetched successfully', success: true, data: coupon });
  } catch (err) {
    logger.error('getCouponById: failed to fetch coupon', { error: err });
    res.status(500).json({ message: err.message, success: false, data: [] });
  }
};

exports.updateCoupon = async (req, res) => {
  try {
    const couponId = req.params.id;
    logger.info('updateCoupon: request received', { couponId, body: req.body });

    const updated = await Coupon.findByIdAndUpdate(
      couponId,
      req.body,
      { new: true, runValidators: true }
    );
    if (!updated) {
      logger.warn('updateCoupon: coupon not found', { couponId });
      return res.status(404).json({ message: 'Coupon not found', success: false, data: [] });
    }

    logger.info('updateCoupon: coupon updated successfully', { couponId });
    res.status(200).json({ message: 'Coupon updated successfully', success: true, data: updated });
  } catch (err) {
    logger.error('updateCoupon: failed to update coupon', { error: err });
    res.status(400).json({ message: err.message, success: false, data: [] });
  }
};

exports.deleteCoupon = async (req, res) => {
  try {
    const couponId = req.params.id;
    logger.info('deleteCoupon: request received', { couponId });

    const deleted = await Coupon.findByIdAndDelete(couponId);
    if (!deleted) {
      logger.warn('deleteCoupon: coupon not found', { couponId });
      return res.status(404).json({ message: 'Coupon not found', success: false, data: [] });
    }

    logger.info('deleteCoupon: coupon deleted successfully', { couponId });
    res.status(200).json({ message: 'Coupon deleted successfully', success: true, data: deleted });
  } catch (err) {
    logger.error('deleteCoupon: failed to delete coupon', { error: err });
    res.status(400).json({ message: err.message, success: false, data: [] });
  }
};