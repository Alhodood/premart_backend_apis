// controllers/appConfigController.js
// PUBLIC endpoints for customer mobile apps - NO AUTH REQUIRED
const { SuperAdmin } = require('../models/AdminAuth');

// Default app configuration values
const DEFAULT_CONFIG = {
  appName: 'PreMart',
  supportEmail: 'support@premart.com',
  supportPhone: '+971-XXX-XXXX',
  taxRate: 5,
  deliveryCharge: 30,
  stripePublicKey: ''
};

/**
 * GET /api/app-config
 * Public endpoint for mobile apps to fetch customer-safe settings
 * NEVER expose sensitive data like stripeSecretKey, platformCommission, etc.
 */
exports.getAppConfig = async (req, res) => {
  try {
    // Find the first super admin (there should be only one)
    const superAdmin = await SuperAdmin.findOne();

    if (!superAdmin || !superAdmin.settings) {
      // Return default values if no settings exist
      return res.status(200).json({
        success: true,
        message: 'App config fetched (defaults)',
        data: DEFAULT_CONFIG
      });
    }

    // Return only customer-safe settings
    res.status(200).json({
      success: true,
      message: 'App config fetched successfully',
      data: {
        appName: superAdmin.settings.appName || DEFAULT_CONFIG.appName,
        supportEmail: superAdmin.settings.supportEmail || DEFAULT_CONFIG.supportEmail,
        supportPhone: superAdmin.settings.supportPhone || DEFAULT_CONFIG.supportPhone,
        taxRate: superAdmin.settings.taxRate || DEFAULT_CONFIG.taxRate,
        deliveryCharge: superAdmin.settings.deliveryCharge || DEFAULT_CONFIG.deliveryCharge,
        stripePublicKey: superAdmin.settings.stripePublicKey || DEFAULT_CONFIG.stripePublicKey
      }
    });
  } catch (err) {
    console.error('❌ Get App Config Error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch app config',
      error: err.message
    });
  }
};
