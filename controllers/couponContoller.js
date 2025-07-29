const Coupon = require('../models/Coupon');

// Create a new coupon under a shop
exports.createCoupon = async (req, res) => {
  try {
    // Extract startDate (if provided) and default to current time
    const { startDate, ...couponData } = req.body;
    couponData.startDate = startDate
      ? new Date(startDate)
      : new Date();

    // Create and save a standalone Coupon document
    const newCoupon = new Coupon(couponData);
    const saved = await newCoupon.save();

    res.status(201).json({ data: saved, success: true, message: "coupon created successfully" });
  } catch (err) {
    res.status(400).json({ data: [], success: false, message: err.message });
  }
};

// Get all coupons
exports.getAllCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.find();
    res.status(200).json({ success:true, message: "coupon featched succcessfuly", data:coupons});
  } catch (err) {
    res.status(500).json({ message: err.message, success: false,data:[]});
  }
};

exports.getCouponById = async (req, res) => {
  try {
    const couponId = req.params.id;
    const coupon = await Coupon.findById(couponId);
    if (!coupon) {
      return res.status(404).json({ message: 'Coupon not found', success: false, data: [] });
    }
    res.status(200).json({ message: 'Coupon fetched successfully', success: true, data: coupon });
  } catch (err) {
    res.status(500).json({ message: err.message, success: false, data: [] });
  }
};

exports.updateCoupon = async (req, res) => {
  try {
    const couponId = req.params.id;
    const updated = await Coupon.findByIdAndUpdate(
      couponId,
      req.body,
      { new: true, runValidators: true }
    );
    if (!updated) {
      return res.status(404).json({ message: 'Coupon not found', success: false, data: [] });
    }
    res.status(200).json({ message: 'Coupon updated successfully', success: true, data: updated });
  } catch (err) {
    res.status(400).json({ message: err.message, success: false, data: [] });
  }
};

exports.deleteCoupon = async (req, res) => {
  try {
    const couponId = req.params.id;
    const deleted = await Coupon.findByIdAndDelete(couponId);
    if (!deleted) {
      return res.status(404).json({ message: 'Coupon not found', success: false, data: [] });
    }
    res.status(200).json({ message: 'Coupon deleted successfully', success: true, data: deleted });
  } catch (err) {
    res.status(400).json({ message: err.message, success: false, data: [] });
  }
};
