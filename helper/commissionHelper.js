// helpers/commissionHelper.js
const { getSuperAdminSettings } = require('./settingsHelper');

/**
 * Get commission rates from Super Admin settings
 * Returns shop and agency commission percentages
 */
async function getCommissionRates() {
  try {
    const settings = await getSuperAdminSettings();
    return {
      shopCommission: settings.platformCommission || 5,
      agencyCommission: settings.agencyCommission || 2
    };
  } catch (error) {
    console.error('❌ Error fetching commission rates:', error);
    // Return safe defaults
    return {
      shopCommission: 5,
      agencyCommission: 2
    };
  }
}

module.exports = {
  getCommissionRates
};