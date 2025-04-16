const Banner = require('../models/Banners');

// Create new banner
exports.addBanner = async (req, res) => {
  try {
    const { title, pic, visibility } = req.body;
    const newBanner = new Banner({ title, pic, visibility });
    await newBanner.save();
    res.status(201).json({ message: 'Banner added successfully', data: newBanner });
  } catch (error) {
    res.status(500).json({ message: 'Failed to add banner', error: error.message });
  }
};

// Get all banners
exports.getAllBanners = async (req, res) => {
  try {
    const banners = await Banner.find();
    res.status(200).json({ message: 'Banners retrieved successfully', data: banners });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch banners', error: error.message });
  }
};

// Get banner by ID
exports.getBannerById = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner) {
      return res.status(404).json({ message: 'Banner not found' });
    }
    res.status(200).json({ message: 'Banner retrieved successfully', data: banner });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch banner', error: error.message });
  }
};

// Update banner
exports.updateBanner = async (req, res) => {
  try {
    const updatedBanner = await Banner.findByIdAndUpdate(
      req.params.id,
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
