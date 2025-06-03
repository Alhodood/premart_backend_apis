const { Shop } = require('../models/Shop');
const Order = require('../models/Order');

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
        EmiratesIdImage: req.body.shopeDetails.EmiratesIdImage,
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
    const shops = await Shop.find().lean();
    const formattedShops = shops.map(shop => {
      return {
        _id: shop._id,
        shopName: shop.shopeDetails?.shopName,
        orderCount: shop.orders?.length || 0,
        shopAddress: shop.shopeDetails?.shopAddress,
        shopMail: shop.shopeDetails?.shopMail,
        shopContact: shop.shopeDetails?.shopContact,
        shopLicenseNumber: shop.shopeDetails?.shopLicenseNumber,
        EmiratesId: shop.shopeDetails?.EmiratesId,
        shopLicenseImage: shop.shopeDetails?.shopLicenseImage,
        bankName: shop.shopeDetails?.shopBankDetails?.bankName,
        accountNumber: shop.shopeDetails?.shopBankDetails?.accountNumber,
        supportMail: shop.shopeDetails?.supportMail,
        supportNumber: shop.shopeDetails?.supportNumber,
        createdAt: shop.createdAt
      };
    });
    res.status(200).json({ success: true, data: formattedShops, message: "shops featched successfuly" });
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



exports.searchShopsForSuperAdmin = async (req, res) => {
  try {
    const {
      search,
      emiratesId,
      fromExpiry,
      toExpiry,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sort = 'desc'
    } = req.query;

    let filter = {};

    // Text search
    if (search) {
      filter.$or = [
        { 'shopeDetails.shopName': { $regex: search, $options: 'i' } },
        { 'shopeDetails.shopMail': { $regex: search, $options: 'i' } },
        { 'shopeDetails.shopContact': { $regex: search, $options: 'i' } }
      ];
    }

    // Emirates ID filter
    if (emiratesId) {
      filter['shopeDetails.EmiratesId'] = emiratesId;
    }

    // License Expiry filter
    if (fromExpiry && toExpiry) {
      filter['shopeDetails.shopLicenseExpiry'] = {
        $gte: fromExpiry,
        $lte: toExpiry
      };
    }

    const shops = await Shop.find(filter)
      .sort({ [sortBy]: sort === 'asc' ? 1 : -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Shop.countDocuments(filter);

    return res.status(200).json({
      message: 'Filtered shops fetched successfully',
      success: true,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      data: shops
    });

  } catch (error) {
    console.error('Shop Filter Error:', error);
    res.status(500).json({
      message: 'Failed to fetch shops',
      success: false,
      data: error.message
    });
  }
};



exports.shopConfirmReady = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { shopId } = req.body;

    if (!shopId) {
      return res.status(400).json({
        message: 'shopId is required',
        success: false
      });
    }

    const order = await Order.findOne({ _id: orderId, shopId });

    if (!order) {
      return res.status(404).json({
        message: 'Order not found or does not belong to this shop',
        success: false
      });
    }

    if (order.orderStatus !== 'Accepted by Delivery Boy') {
      return res.status(400).json({
        message: `Cannot mark order as ready from current status: ${order.orderStatus}`,
        success: false
      });
    }

    order.orderStatus = 'Ready for Pickup';
    await order.save();

    return res.status(200).json({
      message: 'Order marked as Ready for Pickup',
      success: true,
      data: order
    });

  } catch (error) {
    console.error('Vendor Confirm Ready Error:', error);
    return res.status(500).json({
      message: 'Internal Server Error',
      success: false,
      error: error.message
    });
  }
};