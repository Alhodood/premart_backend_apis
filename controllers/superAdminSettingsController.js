// controllers/superAdminSettingsController.js
const { SuperAdmin } = require('../models/AdminAuth');

// GET Super Admin Settings
exports.getSuperAdminSettings = async (req, res) => {
  try {
    const { superAdminId } = req.params;
    
    console.log('📊 Fetching settings for super admin:', superAdminId);

    // Find super admin with settings
    const superAdmin = await SuperAdmin.findById(superAdminId);
    
    if (!superAdmin) {
      return res.status(404).json({
        success: false,
        message: 'Super admin not found'
      });
    }

    // If settings don't exist, initialize with defaults
    if (!superAdmin.settings) {
      superAdmin.settings = {
        appName: 'PreMart',
        supportEmail: 'support@premart.com',
        supportPhone: '+971-XXX-XXXX',
        supportWhatsapp: '+971-XXX-XXXX',  // ✅ NEW
        platformCommission: 10,
        taxRate: 5,
        stripePublicKey: '',
        stripeSecretKey: '',
        deliveryCharge: 30,
        freeDeliveryThreshold: 500,
        maxActiveOrdersPerDeliveryBoy: 5,
        perKmRate: 2
      };
      await superAdmin.save();
    }

    console.log('✅ Settings fetched successfully');

    res.status(200).json({
      success: true,
      message: 'Settings fetched successfully',
      data: {
        superAdminId: superAdmin._id,
        appName: superAdmin.settings.appName || 'PreMart',
        supportEmail: superAdmin.settings.supportEmail || '',
        supportPhone: superAdmin.settings.supportPhone || '',
        supportWhatsapp: superAdmin.settings.supportWhatsapp || '',  // ✅ NEW
        platformCommission: superAdmin.settings.platformCommission || 10,
        taxRate: superAdmin.settings.taxRate || 5,
        stripePublicKey: superAdmin.settings.stripePublicKey || '',
        stripeSecretKey: superAdmin.settings.stripeSecretKey || '',
        deliveryCharge: superAdmin.settings.deliveryCharge || 30,
        freeDeliveryThreshold: superAdmin.settings.freeDeliveryThreshold || 500,
        maxActiveOrdersPerDeliveryBoy: superAdmin.settings.maxActiveOrdersPerDeliveryBoy || 5,
        perKmRate: superAdmin.settings.perKmRate || 2,
        updatedAt: superAdmin.updatedAt
      }
    });
  } catch (err) {
    console.error('❌ Get Settings Error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch settings',
      error: err.message
    });
  }
};

// UPDATE Super Admin Settings
exports.updateSuperAdminSettings = async (req, res) => {
  try {
    const { superAdminId } = req.params;
    const updateData = req.body;

    console.log('📝 Updating settings for super admin:', superAdminId);
    console.log('📦 Update data:', updateData);

    // Find super admin
    const superAdmin = await SuperAdmin.findById(superAdminId);
    
    if (!superAdmin) {
      return res.status(404).json({
        success: false,
        message: 'Super admin not found'
      });
    }

    // Validate numeric fields
    if (updateData.platformCommission !== undefined) {
      const commission = Number(updateData.platformCommission);
      if (isNaN(commission) || commission < 0 || commission > 100) {
        return res.status(400).json({
          success: false,
          message: 'Platform commission must be between 0 and 100'
        });
      }
    }

    if (updateData.taxRate !== undefined) {
      const taxRate = Number(updateData.taxRate);
      if (isNaN(taxRate) || taxRate < 0 || taxRate > 100) {
        return res.status(400).json({
          success: false,
          message: 'Tax rate must be between 0 and 100'
        });
      }
    }

    if (updateData.deliveryCharge !== undefined) {
      const charge = Number(updateData.deliveryCharge);
      if (isNaN(charge) || charge < 0) {
        return res.status(400).json({
          success: false,
          message: 'Delivery charge must be a positive number'
        });
      }
    }

    if (updateData.freeDeliveryThreshold !== undefined) {
      const threshold = Number(updateData.freeDeliveryThreshold);
      if (isNaN(threshold) || threshold < 0) {
        return res.status(400).json({
          success: false,
          message: 'Free delivery threshold must be a positive number'
        });
      }
    }

    if (updateData.maxActiveOrdersPerDeliveryBoy !== undefined) {
      const maxOrders = Number(updateData.maxActiveOrdersPerDeliveryBoy);
      if (isNaN(maxOrders) || maxOrders < 1 || maxOrders > 20) {
        return res.status(400).json({
          success: false,
          message: 'Max active orders must be between 1 and 20'
        });
      }
    }

    if (updateData.perKmRate !== undefined) {
      const kmRate = Number(updateData.perKmRate);
      if (isNaN(kmRate) || kmRate < 0) {
        return res.status(400).json({
          success: false,
          message: 'Per KM rate must be a positive number'
        });
      }
    }

    // ✅ NEW: Validate WhatsApp number
    if (updateData.supportWhatsapp !== undefined) {
      const whatsapp = updateData.supportWhatsapp.trim();
      if (whatsapp && !whatsapp.startsWith('+')) {
        return res.status(400).json({
          success: false,
          message: 'WhatsApp number must include country code (e.g., +971)'
        });
      }
    }

    // Initialize settings if it doesn't exist
    if (!superAdmin.settings) {
      superAdmin.settings = {};
    }

    // Update settings fields
    if (updateData.appName !== undefined) {
      superAdmin.settings.appName = updateData.appName.trim();
    }
    if (updateData.supportEmail !== undefined) {
      superAdmin.settings.supportEmail = updateData.supportEmail.trim();
    }
    if (updateData.supportPhone !== undefined) {
      superAdmin.settings.supportPhone = updateData.supportPhone.trim();
    }
    // ✅ NEW: Update WhatsApp number
    if (updateData.supportWhatsapp !== undefined) {
      superAdmin.settings.supportWhatsapp = updateData.supportWhatsapp.trim();
    }
    if (updateData.platformCommission !== undefined) {
      superAdmin.settings.platformCommission = Number(updateData.platformCommission);
    }
    if (updateData.taxRate !== undefined) {
      superAdmin.settings.taxRate = Number(updateData.taxRate);
    }
    if (updateData.stripePublicKey !== undefined) {
      superAdmin.settings.stripePublicKey = updateData.stripePublicKey.trim();
    }
    if (updateData.stripeSecretKey !== undefined) {
      superAdmin.settings.stripeSecretKey = updateData.stripeSecretKey.trim();
    }
    if (updateData.deliveryCharge !== undefined) {
      superAdmin.settings.deliveryCharge = Number(updateData.deliveryCharge);
    }
    if (updateData.freeDeliveryThreshold !== undefined) {
      superAdmin.settings.freeDeliveryThreshold = Number(updateData.freeDeliveryThreshold);
    }
    if (updateData.maxActiveOrdersPerDeliveryBoy !== undefined) {
      superAdmin.settings.maxActiveOrdersPerDeliveryBoy = Number(updateData.maxActiveOrdersPerDeliveryBoy);
    }
    if (updateData.perKmRate !== undefined) {
      superAdmin.settings.perKmRate = Number(updateData.perKmRate);
    }

    // Mark settings as modified (important for nested objects)
    superAdmin.markModified('settings');
    
    // Save the updated super admin
    await superAdmin.save();

    console.log('✅ Settings updated successfully');

    res.status(200).json({
      success: true,
      message: 'Settings updated successfully',
      data: {
        superAdminId: superAdmin._id,
        settings: superAdmin.settings
      }
    });
  } catch (err) {
    console.error('❌ Update Settings Error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to update settings',
      error: err.message
    });
  }
};

// RESET Settings to Default
exports.resetSuperAdminSettings = async (req, res) => {
  try {
    const { superAdminId } = req.params;

    console.log('🔄 Resetting settings for super admin:', superAdminId);

    // Find super admin
    const superAdmin = await SuperAdmin.findById(superAdminId);
    
    if (!superAdmin) {
      return res.status(404).json({
        success: false,
        message: 'Super admin not found'
      });
    }

    // Reset to default settings
    superAdmin.settings = {
      appName: 'PreMart',
      supportEmail: 'support@premart.com',
      supportPhone: '+971-XXX-XXXX',
      supportWhatsapp: '+971-XXX-XXXX',  // ✅ NEW
      platformCommission: 10,
      taxRate: 5,
      stripePublicKey: '',
      stripeSecretKey: '',
      deliveryCharge: 30,
      freeDeliveryThreshold: 500,
      maxActiveOrdersPerDeliveryBoy: 5,
      perKmRate: 2
    };

    superAdmin.markModified('settings');
    await superAdmin.save();

    console.log('✅ Settings reset to default');

    res.status(200).json({
      success: true,
      message: 'Settings reset to default successfully',
      data: {
        superAdminId: superAdmin._id,
        settings: superAdmin.settings
      }
    });
  } catch (err) {
    console.error('❌ Reset Settings Error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to reset settings',
      error: err.message
    });
  }
};