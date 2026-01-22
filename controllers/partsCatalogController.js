const PartsCatalog = require('../models/PartsCatalog');
const Engine = require('../models/Engine');
const Transmission = require('../models/Transmission');
const VehicleConfiguration = require('../models/VehicleConfiguration');

// CREATE PART
exports.createPart = async (req, res) => {
  try {
    const {
      partNumber,
      partName,
      category,
      compatibleVehicleConfigs
    } = req.body;

    console.log('📦 Create Part Request:', JSON.stringify(req.body, null, 2));

    if (!partNumber || !partName || !category) {
      return res.status(400).json({
        success: false,
        message: 'partNumber, partName, category are required'
      });
    }

    const existing = await PartsCatalog.findOne({ partNumber });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Part with this partNumber already exists'
      });
    }

    // Validate vehicle config IDs if provided
    if (compatibleVehicleConfigs?.length) {
      const validCount = await VehicleConfiguration.countDocuments({
        _id: { $in: compatibleVehicleConfigs }
      });

      if (validCount !== compatibleVehicleConfigs.length) {
        return res.status(400).json({
          success: false,
          message: 'One or more invalid vehicleConfiguration IDs'
        });
      }
    }

    // Create the part
    const part = await PartsCatalog.create(req.body);
    console.log('✅ Part created:', part._id);

    // Populate the response
    const populated = await PartsCatalog.findById(part._id)
      .populate({
        path: 'compatibleVehicleConfigs',
        populate: {
          path: 'brand model',
          select: 'brandName modelName'
        }
      })
      .populate('category', 'categoryName')
      .populate('subCategory', 'subCategoryName');

    res.status(201).json({ success: true, data: populated });

  } catch (err) {
    console.error('❌ Create Part Error:', err);
    console.error('Error details:', err.message);
    console.error('Stack:', err.stack);
    res.status(500).json({ 
      success: false, 
      message: err.message,
      error: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
};

// UPDATE PART - NEW ENDPOINT
exports.updatePart = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    console.log('🔄 Update Part Request');
    console.log('📋 Part ID:', id);
    console.log('📦 Update Data:', JSON.stringify(updateData, null, 2));

    // Validate part ID
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Part ID is required'
      });
    }

    // Check if part exists
    const existingPart = await PartsCatalog.findById(id);
    if (!existingPart) {
      console.log('❌ Part not found with ID:', id);
      return res.status(404).json({
        success: false,
        message: 'Part not found'
      });
    }

    console.log('✅ Found existing part:', existingPart.partNumber);

    // If partNumber is being updated, check for duplicates
    if (updateData.partNumber && updateData.partNumber !== existingPart.partNumber) {
      const duplicate = await PartsCatalog.findOne({ 
        partNumber: updateData.partNumber,
        _id: { $ne: id }
      });
      
      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: 'Part with this part number already exists'
        });
      }
    }

    // Validate vehicle config IDs if provided
    if (updateData.compatibleVehicleConfigs && Array.isArray(updateData.compatibleVehicleConfigs)) {
      if (updateData.compatibleVehicleConfigs.length > 0) {
        const validCount = await VehicleConfiguration.countDocuments({
          _id: { $in: updateData.compatibleVehicleConfigs }
        });

        if (validCount !== updateData.compatibleVehicleConfigs.length) {
          return res.status(400).json({
            success: false,
            message: 'One or more invalid vehicle configuration IDs'
          });
        }
        console.log('✅ Validated vehicle configurations');
      }
    }

    // Update the part
    const updatedPart = await PartsCatalog.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('category', 'categoryName')
      .populate('subCategory', 'subCategoryName')
      .populate({
        path: 'compatibleVehicleConfigs',
        populate: {
          path: 'brand model',
          select: 'brandName modelName year engineType transmission'
        }
      });

    if (!updatedPart) {
      return res.status(404).json({
        success: false,
        message: 'Failed to update part'
      });
    }

    console.log('✅ Part updated successfully:', updatedPart._id);

    res.json({ 
      success: true, 
      message: 'Part updated successfully',
      data: updatedPart 
    });

  } catch (err) {
    console.error('❌ Update Part Error:', err);
    console.error('Error details:', err.message);
    console.error('Stack:', err.stack);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update part',
      error: err.message
    });
  }
};

// GET ALL PARTS - FIXED
exports.getAllParts = async (req, res) => {
  try {
    const parts = await PartsCatalog.find({ isActive: true })
      .populate('category', 'categoryName')
      .populate('subCategory', 'subCategoryName')
      .populate({
        path: 'compatibleVehicleConfigs',
        populate: {
          path: 'brand model',
          select: 'brandName modelName'
        }
      })
      .sort({ createdAt: -1 });

    res.json({ success: true, count: parts.length, data: parts });

  } catch (err) {
    console.error('Get All Parts Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};



// GET PART BY ID - FIXED
exports.getPartById = async (req, res) => {
  try {
    const part = await PartsCatalog.findById(req.params.id)
      .populate('category', 'categoryName')
      .populate('subCategory', 'subCategoryName')
      .populate({
        path: 'compatibleVehicleConfigs',
        populate: {
          path: 'brand model',
          select: 'brandName modelName year engineType transmission'
        }
      });

    if (!part || !part.isActive) {
      return res.status(404).json({ success: false, message: 'Part not found' });
    }

    res.json({ success: true, data: part });

  } catch (err) {
    console.error('Get Part Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};



// ADVANCED SEARCH - FIXED
exports.searchParts = async (req, res) => {
  try {
    const {
      partNumber,
      partName,
      category,
      brand,
      model,
      year
    } = req.query;

    const filter = { isActive: true };

    if (partNumber) filter.partNumber = new RegExp(partNumber, 'i');
    if (partName) filter.partName = new RegExp(partName, 'i');
    if (category) filter.category = category;

    // For brand/model/year filtering, we need to:
    // 1. Find matching VehicleConfigurations
    // 2. Then find parts with those configs
    let vehicleConfigIds = null;
    
    if (brand || model || year) {
      const vehicleFilter = {};
      if (brand) vehicleFilter.brand = brand;
      if (model) vehicleFilter.model = model;
      if (year) vehicleFilter.year = Number(year);
      
      const matchingConfigs = await VehicleConfiguration.find(vehicleFilter).select('_id');
      vehicleConfigIds = matchingConfigs.map(c => c._id);
      
      if (vehicleConfigIds.length > 0) {
        filter.compatibleVehicleConfigs = { $in: vehicleConfigIds };
      } else {
        // No matching configs found, return empty
        return res.json({ success: true, count: 0, data: [] });
      }
    }

    const results = await PartsCatalog.find(filter)
      .populate('category', 'categoryName')
      .populate('subCategory', 'subCategoryName')
      .populate({
        path: 'compatibleVehicleConfigs',
        populate: {
          path: 'brand model',
          select: 'brandName modelName year engineType transmission'
        }
      })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: results.length,
      data: results
    });

  } catch (err) {
    console.error('Search Parts Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};



// SOFT DELETE
exports.deactivatePart = async (req, res) => {
  try {
    const part = await PartsCatalog.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    )
      .populate('category', 'categoryName')
      .populate('subCategory', 'subCategoryName');

    if (!part) {
      return res.status(404).json({ success: false, message: 'Part not found' });
    }

    res.json({ success: true, data: part });

  } catch (err) {
    console.error('Deactivate Part Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};