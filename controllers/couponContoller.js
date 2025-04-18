const Coupon = require('../models/Coupon');

// Create a new coupon under a shop
exports.createCoupon = async (req, res) => {
  try {
    const shopeId= req.shopId;
    const  couponData = req.body;

    let shopCoupon = await Coupon.findOne({ shopeId });

    if (!shopCoupon) {
      // Create a new document if none exists
      shopCoupon = new Coupon({
        shopeId,
        cartProduct: [couponData]
      });
    } else {
      // Push to existing cartProduct array
      shopCoupon.cartProduct.push(couponData);
    }

    const saved = await shopCoupon.save();
    res.status(201).json({data:saved,success:true, message: "coupon featched succcessfuly" });
  } catch (err) {
    res.status(400).json({ data:[],success:false, message:  err.message });
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

// Get all coupons by shop
exports.getCouponsByShop = async (req, res) => {
  try {
    const { shopeId } = req.params;
    const coupons = await Coupon.findOne({ shopeId });

    if (!coupons) return res.status(404).json({ message: 'No coupons found for this shop' });

    res.status(200).json({message: err.message, success: true,data:coupons});
  } catch (err) {
    res.status(500).json({  message: err.message, success: false,data:[] });
  }
};

// Update a specific coupon by shopId and couponId
exports.updateCoupon = async (req, res) => {
  try {
    const { shopeId, couponId } = req.params;

    const updated = await Coupon.findOneAndUpdate(
      { shopeId, 'cartProduct._id': couponId },
      { $set: { 'cartProduct.$': req.body } },
      { new: true }
    );

    if (!updated) return res.status(404).json({ message: 'Coupon not found', success: false,data:[] });

    res.status(200).json({message: "cart featched successfuly", success: true,data:updated});
  } catch (err) {
    res.status(400).json({ message: err.message, success: false,data:[] });
  }
};

// Delete a specific coupon by shopId and couponId
exports.deleteCoupon = async (req, res) => {
  try {
    const { shopeId, couponId } = req.params;

    const updated = await Coupon.findOneAndUpdate(
      { shopeId },
      { $pull: { cartProduct: { _id: couponId } } },
      { new: true }
    );

    if (!updated) return res.status(404).json({ message: 'Coupon not found', success: false,data:[] });

    res.status(200).json({message: err.message, success: true,data:updated});
  } catch (err) {
    res.status(400).json({  message: err.message, success: false,data:[]});
  }
};
