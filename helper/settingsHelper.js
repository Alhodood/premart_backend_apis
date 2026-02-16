// helpers/settingsHelper.js
const { SuperAdmin } = require('../models/AdminAuth');

// Cache settings to avoid DB calls on every request
let cachedSettings = null;
let lastFetch = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get Super Admin Settings (with caching)
 * Returns default values if no settings exist
 */
async function getSuperAdminSettings() {
  try {
    const now = Date.now();
    
    // Return cached if still valid
    if (cachedSettings && (now - lastFetch < CACHE_DURATION)) {
      return cachedSettings;
    }

    // Fetch from DB
    const superAdmin = await SuperAdmin.findOne();
    
    if (!superAdmin || !superAdmin.settings) {
      // Return defaults
      cachedSettings = {
        platformCommission: 5,
        agencyCommission: 2,
        perKmRate: 2,
        deliveryCharge: 30,
        freeDeliveryThreshold: 500,
        maxActiveOrdersPerDeliveryBoy: 5,
        deliveryAssignmentRadius: [3, 5, 10, 50],
        estimatedSpeedKmh: 30
      };
    } else {
      cachedSettings = {
        platformCommission: superAdmin.settings.platformCommission || 5,
        agencyCommission: superAdmin.settings.agencyCommission || 2,
        perKmRate: superAdmin.settings.perKmRate || 2,
        deliveryCharge: superAdmin.settings.deliveryCharge || 30,
        freeDeliveryThreshold: superAdmin.settings.freeDeliveryThreshold || 500,
        maxActiveOrdersPerDeliveryBoy: superAdmin.settings.maxActiveOrdersPerDeliveryBoy || 5,
        deliveryAssignmentRadius: [3, 5, 10, 50],
        estimatedSpeedKmh: 30
      };
    }
    
    lastFetch = now;
    return cachedSettings;
    
  } catch (error) {
    console.error('❌ Settings fetch error:', error);
    // Return safe defaults on error
    return {
      platformCommission: 5,
      agencyCommission: 2,
      perKmRate: 2,
      deliveryCharge: 30,
      freeDeliveryThreshold: 500,
      maxActiveOrdersPerDeliveryBoy: 5,
      deliveryAssignmentRadius: [3, 5, 10, 50],
      estimatedSpeedKmh: 30
    };
  }
}

/**
 * Clear settings cache (call after updating settings)
 */
function clearSettingsCache() {
  cachedSettings = null;
  lastFetch = 0;
}

module.exports = {
  getSuperAdminSettings,
  clearSettingsCache
};