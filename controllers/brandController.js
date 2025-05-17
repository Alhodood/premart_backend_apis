const Brand = require('../models/Brand');

// Create a new brand
exports.createBrand = async (req, res) => {
  console.log("hi")
  try {

    const { brandName } = req.body;
    const newBrand = new Brand({
      brandName,
      brandImage,
      visibility: true
    });
    await newBrand.save();
    res.status(201).json({ message: 'Brand created successfully', data: newBrand,success:true  });
  } catch (error) {
    res.status(500).json({ message: 'Error creating brand', data: error.message, success:false });
  }
};

// Get all brands
exports.getAllBrands = async (req, res) => {
  try {
    const brands = await Brand.find();
    res.status(200).json({ data: brands ,success:true, message:"brand featched"});
  } catch (error) {
    res.status(500).json({ message: 'Error fetching brands', data: error.message, success:false });
  }
};

// Get a single brand by ID
exports.getBrandById = async (req, res) => {
  try {
    const brand = await Brand.findById(req.params.id);
    if (!brand) {
      return res.status(404).json({ message: 'Brand not found',success:false ,data:[]});
    }
    res.status(200).json({ data: brand, success:true,message: "brand featched" });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching brand', data: error.message,success:false });
  }
};

// Update brand by ID
exports.updateBrand = async (req, res) => {
  try {
    const updatedBrand = await Brand.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!updatedBrand) {
      return res.status(404).json({ message: 'Brand not found' ,success:false});
    }
    res.status(200).json({ message: 'Brand updated successfully', data: updatedBrand ,success:true});
  } catch (error) {
    res.status(500).json({ message: 'Error updating brand', data: error.message, success:false });
  }
};

//Delete brand by ID
exports.deleteBrand = async (req, res) => {
  try {
    const deletedBrand = await Brand.findByIdAndDelete(req.params.id);
    if (!deletedBrand) {
      return res.status(404).json({ message: 'Brand not found',success:false , data:[]});
    }
    res.status(200).json({ message: 'Brand deleted successfully', success:true ,data:this.deleteBrand});
  } catch (error) {
    res.status(500).json({ message: 'Error deleting brand', data: error.message, success:false });
  }
};
