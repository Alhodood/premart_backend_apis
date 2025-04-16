const Coupon = require('../models/Coupon');
// Create a new Banner
exports.createCoupon = async (req, res) => {
  try {
    // For security, you can use middleware to ensure only Banner Admin can call this endpoint.
    const coupon = new Coupon(req.body);
    const savedCoupon = await coupon.save();
    res.status(201).json({ message: 'Coupon to created successfuly', data: savedCoupon ,success: true});
  } catch (error) {
    res.status(500).json({ message: 'Failed to create coupon', data: error.message ,success: false});
  }
};

// Retrieve all Banners with filtering and pagination
exports.getCoupon = async (req, res) => {
  try {
    // Optional filtering and pagination. By default, page 1 and limit 10.
    const { page = 1, limit = 10, shopId } = req.query;
  

    // Using lean() for improved read performance.
    const coupon = await Coupon.find(shopId)
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();
    res.status(200).json({ message: 'Coupon featched successfuly', data: coupon ,success: true});
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch coupon', data: error.message,success:false });
  }
};

// Retrieve a single Banner by ID
exports.getCouponById = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id).lean();
    if (!coupon) {
      return res.status(404).json({ message: 'Coupon not found',data: [],success:false  });
    }
    res.status(200).json(coupon);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch coupon', error: error.message,success:false });
  }
};

// Update a Banner by ID
exports.updateCoupon = async (req, res) => {
  try {
    const updatedCoupon = await Coupon.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!updatedCoupon) {
      return res.status(404).json({ message: 'Coupon not found' ,data: [],success:false });
    }
    res.status(200).json({data: updatedCoupon,success:false , message:"Coupon details are updated"});
  } catch (error) {
    res.status(500).json({ message: 'Failed to update coupon', data: error.message , success:false});
  }
};

// Delete a Banner by ID
exports.deleteCoupon = async (req, res) => {
  try {
    const deletedCoupon = await Coupon.findByIdAndDelete(req.params.id);
    if (!deletedCoupon) {
      return res.status(404).json({ message: 'Coupon not found' ,data: [] , success:false});
    }
    res.status(200).json({ message: 'Coupon deleted successfully',data:[] , success:true });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete coupon', data: error.message, success:false });
  }
};



