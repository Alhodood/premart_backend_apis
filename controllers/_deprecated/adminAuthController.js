const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { Shop } = require('../../models/Shop');
const{
  ShopAdmin,
  SuperAdmin
} = require('../../models/AdminAuth');
const twilio = require('twilio');
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret'; // Replace for production
const JWT_EXPIRE = process.env.JWT_EXPIRE || '1d';

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTHTOKEN);





// 🔹 Super Admin Register
exports.registerSuperAdmin = async (req, res) => {
  try {
    const { name, email, phone, password, countryCode, dob } = req.body;

    const existing = await SuperAdmin.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: 'Email already registered', success: false });
    }

    const newUser = new SuperAdmin({
      name,
      email,
      phone,
      password,
      countryCode,
      dob,
      role: 'superAdmin' 
    });

    await newUser.save();

    res.status(201).json({
      message: 'Super Admin registered successfully',
      success: true,
      data: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
        role: newUser.role
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Registration failed', success: false, error: err.message });
  }
};

// 🔹 Super Admin Login
exports.loginSuperAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await SuperAdmin.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'Super Admin not found', success: false });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Incorrect password', success: false });
    }

    res.status(200).json({
      message: 'Login successful',
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Login failed', success: false, error: err.message });
  }
};

// 🔹 Shop Admin Register
exports.registerShopAdmin = async (req, res) => {
  try {
    const {
      name, email, phone, password, countryCode, dob, address, role,
      location, emiratesIdImage, companyLicenseImage
    } = req.body;

    const existing = await ShopAdmin.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: 'Email already registered', success: false });
    }

    const newShopAdmin = new ShopAdmin({
      name, email, phone, password, countryCode, dob,
      address, role, location, emiratesIdImage, companyLicenseImage
    });

    await newShopAdmin.save();

    res.status(201).json({ message: 'Shop Admin registered successfully', success: true, data: newShopAdmin });
  } catch (err) {
    res.status(500).json({ message: 'Registration failed', success: false, error: err.message });
  }
};

exports.getSuperAdminSettings = async (req, res) => {
  try {
    const { adminId } = req.params;

    console.log('📊 Fetching settings for admin:', adminId);

    // Fetch admin document
    const admin = await SuperAdmin.findById(adminId);
    
    if (!admin) {
      return res.status(404).json({ 
        success: false,
        message: 'Super Admin not found' 
      });
    }

    // Get settings or initialize with defaults
    const settings = admin.settings || {};

    console.log('✅ Settings fetched successfully');

    // ✅ FIXED: Return settings in 'data' field (not 'settings')
    return res.status(200).json({
      success: true,
      message: 'Settings fetched successfully',
      data: {
        appName: settings.appName || 'PreMart',
        supportEmail: settings.supportEmail || '',
        supportPhone: settings.supportPhone || '',
        supportWhatsapp: settings.supportWhatsapp || '',  // ✅ NEW
        platformCommission: settings.platformCommission || 10,
        taxRate: settings.taxRate || 5,
        stripePublicKey: settings.stripePublicKey || '',
        stripeSecretKey: settings.stripeSecretKey || '',
        deliveryCharge: settings.deliveryCharge || 30,
        freeDeliveryThreshold: settings.freeDeliveryThreshold || 500,
        maxActiveOrdersPerDeliveryBoy: settings.maxActiveOrdersPerDeliveryBoy || 5,
        perKmRate: settings.perKmRate || 2
      }
    });

  } catch (error) {
    console.error('❌ Get Settings Error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: error.message 
    });
  }
};

// 🔹 Update Super Admin Settings
exports.updateAdminSettings = async (req, res) => {
  try {
    const { adminId } = req.params;
    const updateFields = req.body;

    console.log('📝 Updating settings for admin:', adminId);
    console.log('📦 Update fields:', updateFields);

    // Find admin
    const admin = await SuperAdmin.findById(adminId);

    if (!admin) {
      return res.status(404).json({ 
        success: false,
        message: "Admin not found" 
      });
    }

    // Validate numeric fields
    if (updateFields.platformCommission !== undefined) {
      const commission = Number(updateFields.platformCommission);
      if (isNaN(commission) || commission < 0 || commission > 100) {
        return res.status(400).json({
          success: false,
          message: 'Platform commission must be between 0 and 100'
        });
      }
    }

    if (updateFields.taxRate !== undefined) {
      const taxRate = Number(updateFields.taxRate);
      if (isNaN(taxRate) || taxRate < 0 || taxRate > 100) {
        return res.status(400).json({
          success: false,
          message: 'Tax rate must be between 0 and 100'
        });
      }
    }

    if (updateFields.deliveryCharge !== undefined) {
      const charge = Number(updateFields.deliveryCharge);
      if (isNaN(charge) || charge < 0) {
        return res.status(400).json({
          success: false,
          message: 'Delivery charge must be a positive number'
        });
      }
    }

    if (updateFields.freeDeliveryThreshold !== undefined) {
      const threshold = Number(updateFields.freeDeliveryThreshold);
      if (isNaN(threshold) || threshold < 0) {
        return res.status(400).json({
          success: false,
          message: 'Free delivery threshold must be a positive number'
        });
      }
    }

    if (updateFields.maxActiveOrdersPerDeliveryBoy !== undefined) {
      const maxOrders = Number(updateFields.maxActiveOrdersPerDeliveryBoy);
      if (isNaN(maxOrders) || maxOrders < 1 || maxOrders > 20) {
        return res.status(400).json({
          success: false,
          message: 'Max active orders must be between 1 and 20'
        });
      }
    }

    if (updateFields.perKmRate !== undefined) {
      const kmRate = Number(updateFields.perKmRate);
      if (isNaN(kmRate) || kmRate < 0) {
        return res.status(400).json({
          success: false,
          message: 'Per KM rate must be a positive number'
        });
      }
    }

    // ✅ NEW: Validate WhatsApp number
    if (updateFields.supportWhatsapp !== undefined) {
      const whatsapp = updateFields.supportWhatsapp.trim();
      if (whatsapp && !whatsapp.startsWith('+')) {
        return res.status(400).json({
          success: false,
          message: 'WhatsApp number must include country code (e.g., +971)'
        });
      }
    }

    // Initialize settings if it doesn't exist
    if (!admin.settings) {
      admin.settings = {};
    }

    // ✅ FIXED: Properly merge settings (preserve existing + add new)
    admin.settings = { 
      ...admin.settings.toObject(),  // Convert to plain object first
      ...updateFields 
    };

    // Mark settings as modified (important for nested objects)
    admin.markModified('settings');
    
    // Save
    await admin.save();

    console.log('✅ Settings updated successfully');

    res.status(200).json({
      success: true,
      message: "Settings updated successfully",
      data: admin.settings
    });

  } catch (err) {
    console.error("❌ Settings update error:", err);
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: err.message 
    });
  }
};

// 🔹 Reset Settings to Default
exports.resetSuperAdminSettings = async (req, res) => {
  try {
    const { adminId } = req.params;

    console.log('🔄 Resetting settings for admin:', adminId);

    // Find admin
    const admin = await SuperAdmin.findById(adminId);
    
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Super admin not found'
      });
    }

    // Reset to default settings
    admin.settings = {
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

    admin.markModified('settings');
    await admin.save();

    console.log('✅ Settings reset to default');

    res.status(200).json({
      success: true,
      message: 'Settings reset to default successfully',
      data: admin.settings
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



exports.loginShopAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const shop = await Shop.findOne({ 'shopeDetails.shopMail': email });
    if (!shop || !shop.shopeDetails) {
      return res.status(404).json({ message: 'Shop not found', success: false });
    }

    if (shop.shopeDetails.shopContact !== password) {
      return res.status(401).json({ message: 'Incorrect contact used as password', success: false });
    }

    return res.status(200).json({
      message: 'Login successful',
      success: true,
      data: {
        shopId: shop._id,
        shopName: shop.shopeDetails.shopName,
        shopMail: shop.shopeDetails.shopMail,
        shopContact: shop.shopeDetails.shopContact,
        supportMail: shop.shopeDetails.supportMail,
        supportNumber: shop.shopeDetails.supportNumber,
        shopAddress: shop.shopeDetails.shopAddress,
        location: shop.shopeDetails.shopLocation,
        licenseNumber: shop.shopeDetails.shopLicenseNumber,
        licenseExpiry: shop.shopeDetails.shopLicenseExpiry,
        emiratesId: shop.shopeDetails.EmiratesId,
        bankDetails: shop.shopeDetails.shopBankDetails,
        role: 'shopAdmin'
      }
    });

  } catch (err) {
    console.error('Shop Login Error:', err);
    return res.status(500).json({
      message: 'Login failed',
      success: false,
      error: err.message
    });
  }
};



// 🔹 Update Shop Details
exports.updateShopDetails = async (req, res) => {
  try {
    const { shopId } = req.params;
    const updateFields = req.body;

    const shop = await Shop.findById(shopId);
    if (!shop) {
      return res.status(404).json({ message: 'Shop not found', success: false });
    }

    shop.shopeDetails = {
      ...shop.shopeDetails.toObject(),
      ...updateFields
    };

    await shop.save();

    return res.status(200).json({
      message: 'Shop details updated successfully',
      success: true,
      data: shop.shopeDetails
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update shop details', success: false, error: error.message });
  }
};