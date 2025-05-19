const Coupon = require('../models/Coupon');
const Offer = require('../models/Offers');
const mongoose = require('mongoose');
const { ProductDetails } = require('../models/Product');

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
    const { creatorId } = req.params;
    const filter = creatorId ? { creatorId } : {};
    const coupons = await Coupon.find(filter).sort({ createdAt: -1 });
    res.status(200).json({ message: 'Coupons fetched', success: true, data: coupons });
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
        const productDetails = await ProductDetails.find({
          _id: { $in: offer.productIds.map(id => new mongoose.Types.ObjectId(id)) }
        });
        const now = new Date();
        const offerObj = offer.toObject();
        const isCurrentlyActive = offerObj.startDate <= now && offerObj.endDate >= now;
        return {
          ...offerObj,
          isActive: isCurrentlyActive,
          status: isCurrentlyActive ? 'Active' : 'Inactive',
          fullProductDetails: productDetails
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