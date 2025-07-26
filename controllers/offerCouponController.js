const Coupon = require('../models/Coupon');
const Offer = require('../models/Offers');
const mongoose = require('mongoose');
const { Product } = require('../models/Product');

exports.createCoupon = async (req, res) => {
  try {
    const { creatorId, ...rest } = req.body;
    const coupon = new Coupon({ ...rest, creatorId });
    await coupon.save();
    res.status(201).json({ message: 'Coupon created', success: true, data: coupon });
  } catch (err) {
    res.status(500).json({ message: 'Failed to create coupon', success: false, data: err.message });
  }
};

exports.getAllCoupons = async (req, res) => {
  try {
    const filter = {};
    const coupons = await Coupon.find(filter).sort({ createdAt: -1 });
    const transformedCoupons = coupons.map(coupon => ({
      _id: coupon._id,
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      minOrderAmount: coupon.minOrderAmount,
      usageLimit: coupon.usageLimit,
      usedCount: coupon.usedCount,
      expiryDate: coupon.expiryDate,
      isActive: coupon.isActive,
      createdAt: coupon.createdAt
    }));
    res.status(200).json({ message: 'Coupons fetched', success: true, data: transformedCoupons });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch coupons', success: false, data: err.message });
  }
};

exports.updateCoupon = async (req, res) => {
  try {
    const updated = await Coupon.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.status(200).json({ message: 'Coupon updated', success: true, data: updated });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update coupon', success: false, data: err.message });
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



exports.applyCoupon = async (req, res) => {
  const { userId, code, orderAmount } = req.body;

  if (!userId || !code || orderAmount === undefined) {
    return res.status(400).json({ message: 'userId, code, and orderAmount are required', success: false });
  }

  try {
    const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true });

    if (!coupon) {
      return res.status(200).json({ message: 'Invalid or inactive coupon code', success: false,data:[] });
    }

    // ✅ Check if coupon has valid discount fields
    if (!coupon.discountType || coupon.discountValue === undefined) {
      return res.status(200).json({
        message: 'Coupon data is invalid. Missing discountType or discountValue',
        success: false
      });
    }

    // ✅ Check if coupon has valid discount fields
    if (!coupon.discountType || coupon.discountValue === undefined) {
      return res.status(400).json({
        message: 'Coupon data is invalid. Missing discountType or discountValue',
        success: false
      });
    }

    // ✅ Check expiry
    const now = new Date();
    if (coupon.expiryDate && coupon.expiryDate < now) {
      return res.status(200).json({ message: 'Coupon has expired', success: false,data:[] });
    }

    // ✅ Check if already used
    if (coupon.usedBy && coupon.usedBy.includes(userId)) {
      return res.status(400).json({ message: 'Coupon already used by this user', success: false });
    }

    // ✅ Check minimum order amount
    if (coupon.minOrderAmount && orderAmount < coupon.minOrderAmount) {
      return res.status(200).json({
        message: `Minimum order amount is ${coupon.minOrderAmount}`,
        success: false
      });
    }

    // ✅ Check usage limit
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      return res.status(200).json({ message: 'Coupon usage limit reached', success: false ,data:[]});
    }

    // ✅ Calculate discount
    let discount = 0;
    if (coupon.discountType === 'flat') {
      discount = coupon.discountValue;
    } else if (coupon.discountType === 'percent') {
      discount = (orderAmount * coupon.discountValue) / 100;
    }

    const finalAmount = Math.max(orderAmount - discount, 0);

    // 💡 Do not mark it used here — as per your instruction

    return res.status(200).json({
      message: 'Coupon applied successfully',
      success: true,
      data: {
        discount,
        finalAmount,
        couponId: coupon._id
      }
    });

  } catch (err) {
    console.error('Coupon Error:', err);
    return res.status(500).json({ message: 'Error applying coupon', success: false, error: err.message ,data:[]});
  }
};




//----------------------------

// Offers
exports.createOffer = async (req, res) => {
  try {
    const { creatorId, ...rest } = req.body;
    const offer = new Offer({ ...rest, creatorId });
    await offer.save();
    res.status(201).json({ message: 'Offer created', success: true, data: offer });
  } catch (err) {
    res.status(500).json({ message: 'Failed to create offer', success: false, data: err.message });
  }
};



exports.getAllOffers = async (req, res) => {
  try {
    const { creatorId } = req.params;
    const {
      title,
      minDiscount,
      maxDiscount,
      promoCode,
      startFrom,
      startTo,
      endFrom,
      endTo,
      status
    } = req.query;

    const filter = creatorId ? { shopId: new mongoose.Types.ObjectId(creatorId) } : {};

    if (title) {
      filter.title = { $regex: title, $options: 'i' };
    }

    if (minDiscount || maxDiscount) {
      filter.discountValue = {};
      if (minDiscount) filter.discountValue.$gte = Number(minDiscount);
      if (maxDiscount) filter.discountValue.$lte = Number(maxDiscount);
    }

    if (promoCode) {
      filter.promoCode = { $regex: promoCode, $options: 'i' };
    }

    if (startFrom || startTo) {
      filter.startDate = {};
      if (startFrom) filter.startDate.$gte = new Date(startFrom);
      if (startTo) filter.startDate.$lte = new Date(startTo);
    }

    if (endFrom || endTo) {
      filter.endDate = {};
      if (endFrom) filter.endDate.$gte = new Date(endFrom);
      if (endTo) filter.endDate.$lte = new Date(endTo);
    }

    if (status && status.toLowerCase() !== 'all') {
      const now = new Date();
      const normalizedStatus = status.toLowerCase();

      if (normalizedStatus === 'active') {
        filter.$expr = {
          $and: [
            { $eq: ['$isActive', true] },
            { $lte: ['$startDate', now] },
            { $gte: ['$endDate', now] }
          ]
        };
      } else if (normalizedStatus === 'inactive') {
        filter.$expr = {
          $or: [
            { $eq: ['$isActive', false] },
            { $lt: ['$endDate', now] }
          ]
        };
      } else if (normalizedStatus === 'scheduled') {
        filter.$expr = {
          $and: [
            { $eq: ['$isActive', true] },
            { $gt: ['$startDate', now] }
          ]
        };
      }
    }

    const offers = await Offer.find(filter).sort({ createdAt: -1 });

    const offersWithDetails = await Promise.all(
      offers.map(async (offer) => {
        const now = new Date();
        const offerObj = offer.toObject();
        const isCurrentlyActive = offerObj.startDate <= now && offerObj.endDate >= now;
        return {
          ...offerObj,
          isActive: isCurrentlyActive,
          status: isCurrentlyActive ? 'Active' : 'Inactive'
        };
      })
    );

    res.status(200).json({ message: 'Offers fetched', success: true, data: offersWithDetails });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch offers', success: false, data: err.message });
  }
};

exports.updateOffer = async (req, res) => {
  try {
    const updated = await Offer.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.status(200).json({ message: 'Offer updated', success: true, data: updated });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update offer', success: false, data: err.message });
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

exports.checkOfferValidity = async (req, res) => {
  const { productId, userId } = req.body;

  if (!productId || !userId) {
    return res.status(200).json({
      message: 'productId and userId are required',
      success: false,data:[]
    });
  }

  try {
    const now = new Date();

    // Find active offers that include the product
    const offers = await Offer.find({
      isActive: true,
      productIds: productId,
      startDate: { $lte: now },
      endDate: { $gte: now }
    });

    if (offers.length === 0) {
      return res.status(200).json({
        message: 'No valid offers available for this product',
        success: false,data: []
      });
    }

    // Check if user already used any of the matched offers
    const applicableOffer = offers.find(offer => {
      return !offer.usedBy.some(user => user.toString() === userId);
    });

    if (!applicableOffer) {
      return res.status(200).json({
        message: 'User has already used available offers for this product',
        success: false,
        data:[]
      });
    }

    return res.status(200).json({
      message: 'Valid offer available',
      success: true,
      data: applicableOffer
    });

  } catch (err) {
    console.error('Check Offer Error:', err);
    return res.status(500).json({
      message: 'Failed to check offer',
      success: false,
      error: err.message
    });
  }
};