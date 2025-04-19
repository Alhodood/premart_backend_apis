const { Shop } = require('../models/Shop');

// Create a new shop
exports.createShop = async (req, res) => {
  try {
    const shopId= req.params.shopId;
    const  shopeDetails  = req.body;

    const newShop = new Shop({
      shopId,
      shopeDetails
    });

    const savedShop = await newShop.save();
    res.status(201).json({ success: true, data: savedShop,message:"New shop created successfuly" });
  } catch (error) {
    console.error('Error creating shop:', error);
    res.status(500).json({ success: false, message: 'Server Error',data:[] });
  }
};

// Get all shops
exports.getAllShops = async (req, res) => {
  try {
    const shops = await Shop.find();
    res.status(200).json({ success: true, data: shops, message:"shops featched successfuly"});
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error',data:[] });
  }
};

// Get shop by ID
exports.getShopById = async (req, res) => {
  try {
    const shop = await Shop.findById(req.params.shopId);
    if (!shop) {
      return res.status(404).json({ success: false, message: 'Shop not found' ,data:[]});
    }
    res.status(200).json({ success: true, data: shop , message:"shop featched successfuly"});
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error',data:[] });
  }
};

// Update shop by ID
exports.updateShop = async (req, res) => {
  try {
    const updatedShop = await Shop.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!updatedShop) {
      return res.status(404).json({ success: false, message: 'Shop not found',data:[] });
    }
    res.status(200).json({ success: true, data: updatedShop, message:"shops updated successfuly" });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' ,data:[]});
  }
};

// Delete shop by ID
exports.deleteShop = async (req, res) => {
  try {
    const deletedShop = await Shop.findByIdAndDelete(req.params.id);
    if (!deletedShop) {
      return res.status(404).json({ success: false, message: 'Shop not found',data:[] });
    }
    res.status(200).json({ success: true, message: 'Shop deleted successfully' ,data:deletedShop});
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error',data:[] });
  }
};