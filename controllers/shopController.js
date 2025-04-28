const { Shop } = require('../models/Shop');

// Create a new shop
exports.createShop = async (req, res) => {
  try {
    // const shopId= req.params.shopId;
    const  shopeDetails  = req.body;
console.log(shopeDetails);
    // const newShop = new Shop({
    //   // shopId,
    //   shopeDetails
    // });

    const newShop = new Shop({
      shopeDetails: {
        shopName: req.body.shopeDetails.shopName,
        shopAddress: req.body.shopeDetails.shopAddress,
        shopMail: req.body.shopeDetails.shopMail,
        shopContact: req.body.shopeDetails.shopContact,
        shopLicenseNumber: req.body.shopeDetails.shopLicenseNumber,
        shopLicenseExpiry: req.body.shopeDetails.shopLicenseExpiry,
        shopLicenseImage: req.body.shopeDetails.shopLicenseImage,
        EmiratesId: req.body.shopeDetails.EmiratesId,
        shopLocation: req.body.shopeDetails.shopLocation,
        termsAndCondition: req.body.shopeDetails.termsAndCondition,
        supportMail: req.body.shopeDetails.supportMail,
        supportNumber: req.body.shopeDetails.supportNumber,
        shopBankDetails: req.body.shopeDetails.shopBankDetails
      }
    });
    console.log(newShop);

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
  console.log(req.body);
  try {
    const updatedShop = await Shop.findByIdAndUpdate(
      req.params.id,
      req.body,
      {runValidators: true }
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