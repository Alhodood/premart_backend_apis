const ShopeDetails = require('../models/Shop');
// Create a new shope
exports.createShop = async (req, res) => {
  try {
    // For security, you can use middleware to ensure only Shop Admin can call this endpoint.
    const shop = new ShopeDetails(req.body);
    const savedShop = await shop.save();
    res.status(201).json({ message: 'Shop to created successfuly', data: savedShop ,success: true});
  } catch (error) {
    res.status(500).json({ message: 'Failed to create shope', data: error.message ,success: false});
  }
};

// Retrieve all Shops with filtering and pagination
exports.getShop = async (req, res) => {
  try {
    // Optional filtering and pagination. By default, page 1 and limit 10.
    const { page = 1, limit = 10, category, brand } = req.query;
  

    // Using lean() for improved read performance.
    const shop = await ShopeDetails.find()
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();
    res.status(200).json({ message: 'Shop featched successfuly', data: shop ,success: true});
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch shop', data: error.message,success:false });
  }
};

// Retrieve a single Shop by ID
exports.getShopById = async (req, res) => {
  try {
    const shop = await ShopeDetails.findById(req.params.id).lean();
    if (!shop) {
      return res.status(404).json({ message: 'Shope not found',data: [],success:false  });
    }
    res.status(200).json(shop);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch shope', error: error.message,success:false });
  }
};

// Update a Shop by ID
exports.updateShop = async (req, res) => {
  try {
    const updatedShop = await ShopeDetails.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!updatedShop) {
      return res.status(404).json({ message: 'Shop not found' ,data: [],success:false });
    }
    res.status(200).json({data: updatedShop,success:false , message:"Shop details are updated"});
  } catch (error) {
    res.status(500).json({ message: 'Failed to update shop', data: error.message , success:false});
  }
};

// Delete a Shop by ID
exports.deleteShop = async (req, res) => {
  try {
    const deletedShop = await ShopeDetails.findByIdAndDelete(req.params.id);
    if (!deletedShop) {
      return res.status(404).json({ message: 'Shop not found' ,data: [] , success:false});
    }
    res.status(200).json({ message: 'Shop deleted successfully',data:[] , success:true });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete shop', data: error.message, success:false });
  }
};



