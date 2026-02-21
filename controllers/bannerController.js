const mongoose = require('mongoose');
const Banner = require('../models/Banners');
const logger = require('../config/logger');

// Create new banner
exports.addBanner = async (req, res) => {
  try {
    const { title, pic, redirectScreen, isActive = true } = req.body;
    logger.info('addBanner: request received', { title, redirectScreen });

    const newBanner = new Banner({ title, pic, redirectScreen, isActive });
    await newBanner.save({ validateBeforeSave: false });

    logger.info('addBanner: banner added successfully', { id: newBanner._id });
    res.status(201).json({ message: 'Banner added successfully', data: newBanner });
  } catch (error) {
    logger.error('addBanner: failed to add banner', { error });
    res.status(500).json({ message: 'Failed to add banner', error: error.message });
  }
};

// Get all banners with optional filters
exports.getAllBanners = async (req, res) => {
  try {
    const { title, redirectScreen, isActive } = req.query;
    logger.info('getAllBanners: request received', { title, redirectScreen, isActive });

    const filter = {};
    if (title) filter.title = { $regex: title, $options: 'i' };
    if (redirectScreen) filter.redirectScreen = redirectScreen;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const banners = await Banner.find(filter).sort({ createdAt: -1 });

    logger.info('getAllBanners: banners retrieved successfully', { count: banners.length });
    res.status(200).json({ message: 'Banners retrieved successfully', data: banners });
  } catch (error) {
    logger.error('getAllBanners: failed to fetch banners', { error });
    res.status(500).json({ message: 'Failed to fetch banners', error: error.message });
  }
};

// Get banners by Shop ID
exports.getBannerByShopId = async (req, res) => {
  try {
    const { shopId } = req.params;
    logger.info('getBannerByShopId: request received', { shopId });

    if (!mongoose.Types.ObjectId.isValid(shopId)) {
      logger.warn('getBannerByShopId: invalid shop ID', { shopId });
      return res.status(400).json({ message: 'Invalid Shop ID' });
    }

    const banners = await Banner.find({ shopId: new mongoose.Types.ObjectId(shopId) }).sort({ createdAt: -1 });
    if (!banners || banners.length === 0) {
      logger.warn('getBannerByShopId: no banners found for shop', { shopId });
      return res.status(404).json({ message: 'No banners found for this shop' });
    }

    logger.info('getBannerByShopId: banners retrieved successfully', { shopId, count: banners.length });
    res.status(200).json({ message: 'Banners retrieved successfully', data: banners });
  } catch (error) {
    logger.error('getBannerByShopId: failed to fetch banners', { error });
    res.status(500).json({ message: 'Failed to fetch banners', error: error.message });
  }
};

// Update banner
exports.updateBanner = async (req, res) => {
  try {
    const bannerId = req.params.id;
    logger.info('updateBanner: request received', { bannerId });

    if (!mongoose.Types.ObjectId.isValid(bannerId)) {
      logger.warn('updateBanner: invalid banner ID', { bannerId });
      return res.status(400).json({ message: 'Invalid Banner ID' });
    }

    const updatedBanner = await Banner.findOneAndUpdate(
      { _id: bannerId },
      req.body,
      { new: true, runValidators: true }
    );
    if (!updatedBanner) {
      logger.warn('updateBanner: banner not found', { bannerId });
      return res.status(404).json({ message: 'Banner not found' });
    }

    logger.info('updateBanner: banner updated successfully', { bannerId });
    res.status(200).json({ message: 'Banner updated successfully', data: updatedBanner });
  } catch (error) {
    logger.error('updateBanner: failed to update banner', { error });
    res.status(500).json({ message: 'Failed to update banner', error: error.message });
  }
};

// Delete banner
exports.deleteBanner = async (req, res) => {
  try {
    const bannerId = req.params.id;
    logger.info('deleteBanner: request received', { bannerId });

    const deletedBanner = await Banner.findByIdAndDelete(bannerId);
    if (!deletedBanner) {
      logger.warn('deleteBanner: banner not found', { bannerId });
      return res.status(404).json({ message: 'Banner not found' });
    }

    logger.info('deleteBanner: banner deleted successfully', { bannerId });
    res.status(200).json({ message: 'Banner deleted successfully', data: deletedBanner });
  } catch (error) {
    logger.error('deleteBanner: failed to delete banner', { error });
    res.status(500).json({ message: 'Failed to delete banner', error: error.message });
  }
};