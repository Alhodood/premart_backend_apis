const mongoose = require('mongoose');
const Banner = require('../models/Banners');

// Create new banner
exports.addBanner = async (req, res) => {
  try {
    const { title, pic, redirectScreen, isActive = true } = req.body;

    const newBanner = new Banner({
      title,
      pic,
      redirectScreen,
      isActive,
    });

    // Skip schema validation (so shopId is not required)
    await newBanner.save({ validateBeforeSave: false });
    res.status(201).json({ message: 'Banner added successfully', data: newBanner });
  } catch (error) {
    res.status(500).json({ message: 'Failed to add banner', error: error.message });
  }
};

// Get all banners with optional filters
exports.getAllBanners = async (req, res) => {
  try {
    const { title, redirectScreen, isActive } = req.query;
    const filter = {};

    if (title) {
      filter.title = { $regex: title, $options: 'i' };
    }

    if (redirectScreen) {
      filter.redirectScreen = redirectScreen;
    }

    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    const banners = await Banner.find(filter).sort({ createdAt: -1 });
    res.status(200).json({ message: 'Banners retrieved successfully', data: banners });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch banners', error: error.message });
  }
};

// Get banner by ID
exports.getBannerByShopId = async (req, res) => {
  try {
    const { shopId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(shopId)) {
      return res.status(400).json({ message: 'Invalid Shop ID' });
    }

    const banners = await Banner.find({ shopId: new mongoose.Types.ObjectId(shopId) }).sort({ createdAt: -1 });

    if (!banners || banners.length === 0) {
      return res.status(404).json({ message: 'No banners found for this shop' });
    }

    res.status(200).json({ message: 'Banners retrieved successfully', data: banners });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch banners', error: error.message });
  }
};

// Update banner
exports.updateBanner = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid Banner ID' });
    }
    const updatedBanner = await Banner.findOneAndUpdate(
      { _id: req.params.id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!updatedBanner) {
      return res.status(404).json({ message: 'Banner not found' });
    }
    res.status(200).json({ message: 'Banner updated successfully', data: updatedBanner });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update banner', error: error.message });
  }
};

// Delete banner
exports.deleteBanner = async (req, res) => {
  try {
    const deletedBanner = await Banner.findByIdAndDelete(req.params.id);
    if (!deletedBanner) {
      return res.status(404).json({ message: 'Banner not found' });
    }
    res.status(200).json({ message: 'Banner deleted successfully', data: deletedBanner });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete banner', error: error.message });
  }
};
