const Brands = require('../models/brand');

// Create a new brand
exports.createBrand = async (req, res) => {
  try {
    // For security, you can use middleware to ensure only Shop Admin can call this endpoint.
    const brand = new Brands(req.body);
    const savedBrand = await brand.save();
    res.status(201).json({data:savedBrand, message:"New brand created",success:true});
  } catch (error) {
    res.status(500).json({ message: 'Failed to create brand', data: error.message ,success:false});
  }
};

// Retrieve all brands with filtering and pagination
exports.getBrand = async (req, res) => {
  try {
    // Optional filtering and pagination. By default, page 1 and limit 10.
    const { page = 1, limit = 10 } = req.query;
    // let filter = {};
    // if (category) filter.category = category;
    // if (brand) filter.brand = brand;

    // Using lean() for improved read performance.
    const brand = await Brands.find()
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();
    res.status(200).json({message:"Brand featched",success: true,data:brand});
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch brand', data: error.message ,success: false});
  }
};

// Retrieve a single brand by ID
exports.getBrandById = async (req, res) => {
  try {
    const brand = await Brands.findById(req.params.id).lean();
    if (!brand) {
      return res.status(404).json({ message: 'Brand not found',success: false,data:[] });
    }
    res.status(200).json({data:brand ,success: true,message:'Brand featched'});
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch brand', data: error.message ,success: false });
  }
};

// Update a brand by ID
exports.updateBrand = async (req, res) => {
  try {
    const updatedBrand = await Brands.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!updatedBrand) {
      return res.status(404).json({ message: 'Brand not found' ,success: false,data:[]});
    }
    res.status(200).json({success: true,data:updatedBrand, message:"Brand updated"});
  } catch (error) {
    res.status(500).json({ message: 'Failed to update brand', data: error.message ,success: false});
  }
};

// Delete a brand by ID
exports.deleteBrand = async (req, res) => {
  try {
    const deletedBrands = await Brands.findByIdAndDelete(req.params.id);
    if (!deletedBrands) {
      return res.status(404).json({ message: 'Brand not found',data:[], success: false});
    }
    res.status(200).json({ message: 'Brand deleted successfully',data:[] ,success:true});
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete Brand', data: error.message,success: false });
  }
};
