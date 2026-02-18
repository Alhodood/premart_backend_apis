// controllers/superAdminSettingsController.js
const { SuperAdmin } = require('../models/AdminAuth');

// ─── Default settings (used in init + reset) ───────────────────────────────
const DEFAULT_SETTINGS = {
  appName: 'PreMart',
  supportEmail: 'support@premart.com',
  supportPhone: '+971XXXXXXXXX',
  supportWhatsapp: '+971XXXXXXXXX',
  platformCommission: 10,
  agencyCommission: 2,
  taxRate: 5,
  stripePublicKey: '',
  stripeSecretKey: '',
  deliveryCharge: 30,
  freeDeliveryThreshold: 500,
  maxActiveOrdersPerDeliveryBoy: 5,
  perKmRate: 2,
  address: {
    formattedAddress: '',
    buildingName: '',       // ✅ ADDED
    lat: null,
    lng: null,
    placeId: '',
    city: '',
    country: 'UAE',
  }
};

// ─── Helper: build address object safely ──────────────────────────────────
function buildAddressFromData(addr) {
  return {
    formattedAddress: addr?.formattedAddress?.trim() || '',
    buildingName:     addr?.buildingName?.trim()     || '',  // ✅ ADDED
    lat:     (addr?.lat  !== undefined && addr?.lat  !== null) ? Number(addr.lat)  : null,
    lng:     (addr?.lng  !== undefined && addr?.lng  !== null) ? Number(addr.lng)  : null,
    placeId: addr?.placeId?.trim() || '',
    city:    addr?.city?.trim()    || '',
    country: addr?.country?.trim() || 'UAE',
  };
}

// ─── Helper: serialize address from DB doc ─────────────────────────────────
function serializeAddress(addr) {
  return {
    formattedAddress: addr?.formattedAddress || '',
    buildingName:     addr?.buildingName     || '',   // ✅ ADDED
    lat:     addr?.lat  ?? null,
    lng:     addr?.lng  ?? null,
    placeId: addr?.placeId || '',
    city:    addr?.city    || '',
    country: addr?.country || 'UAE',
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// GET /super-admin/settings/:superAdminId
// ══════════════════════════════════════════════════════════════════════════════
exports.getSuperAdminSettings = async (req, res) => {
  try {
    const { superAdminId } = req.params;
    console.log('📊 Fetching settings for super admin:', superAdminId);

    const superAdmin = await SuperAdmin.findById(superAdminId);

    if (!superAdmin) {
      return res.status(404).json({
        success: false,
        message: 'Super admin not found'
      });
    }

    // Init defaults if settings missing
    if (!superAdmin.settings) {
      superAdmin.settings = DEFAULT_SETTINGS;
      await superAdmin.save();
    }

    const s = superAdmin.settings;

    console.log('✅ Settings fetched successfully');

    res.status(200).json({
      success: true,
      message: 'Settings fetched successfully',
      data: {
        superAdminId:     superAdmin._id,
        appName:          s.appName          || 'PreMart',
        supportEmail:     s.supportEmail     || '',
        supportPhone:     s.supportPhone     || '',
        supportWhatsapp:  s.supportWhatsapp  || '',
        platformCommission:           s.platformCommission           || 10,
        agencyCommission:             s.agencyCommission             || 2,
        taxRate:                      s.taxRate                      || 5,
        stripePublicKey:              s.stripePublicKey              || '',
        stripeSecretKey:              s.stripeSecretKey              || '',
        deliveryCharge:               s.deliveryCharge               || 30,
        freeDeliveryThreshold:        s.freeDeliveryThreshold        || 500,
        maxActiveOrdersPerDeliveryBoy: s.maxActiveOrdersPerDeliveryBoy || 5,
        perKmRate:                    s.perKmRate                    || 2,
        address: serializeAddress(s.address),   // ✅ includes buildingName
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

// ══════════════════════════════════════════════════════════════════════════════
// PUT /super-admin/settings/:superAdminId
// ══════════════════════════════════════════════════════════════════════════════
exports.updateSuperAdminSettings = async (req, res) => {
  try {
    const { superAdminId } = req.params;
    const updateData = req.body;

    console.log('📝 Updating settings for super admin:', superAdminId);
    console.log('📦 Update data:', JSON.stringify(updateData, null, 2));

    const superAdmin = await SuperAdmin.findById(superAdminId);

    if (!superAdmin) {
      return res.status(404).json({
        success: false,
        message: 'Super admin not found'
      });
    }

    // ── Validations ────────────────────────────────────────────────────────
    if (updateData.platformCommission !== undefined) {
      const v = Number(updateData.platformCommission);
      if (isNaN(v) || v < 0 || v > 100)
        return res.status(400).json({ success: false, message: 'Platform commission must be 0–100' });
    }

    if (updateData.agencyCommission !== undefined) {
      const v = Number(updateData.agencyCommission);
      if (isNaN(v) || v < 0 || v > 100)
        return res.status(400).json({ success: false, message: 'Agency commission must be 0–100' });
    }

    if (updateData.taxRate !== undefined) {
      const v = Number(updateData.taxRate);
      if (isNaN(v) || v < 0 || v > 100)
        return res.status(400).json({ success: false, message: 'Tax rate must be 0–100' });
    }

    if (updateData.deliveryCharge !== undefined) {
      const v = Number(updateData.deliveryCharge);
      if (isNaN(v) || v < 0)
        return res.status(400).json({ success: false, message: 'Delivery charge must be >= 0' });
    }

    if (updateData.freeDeliveryThreshold !== undefined) {
      const v = Number(updateData.freeDeliveryThreshold);
      if (isNaN(v) || v < 0)
        return res.status(400).json({ success: false, message: 'Free delivery threshold must be >= 0' });
    }

    if (updateData.maxActiveOrdersPerDeliveryBoy !== undefined) {
      const v = Number(updateData.maxActiveOrdersPerDeliveryBoy);
      if (isNaN(v) || v < 1 || v > 20)
        return res.status(400).json({ success: false, message: 'Max active orders must be 1–20' });
    }

    if (updateData.perKmRate !== undefined) {
      const v = Number(updateData.perKmRate);
      if (isNaN(v) || v < 0)
        return res.status(400).json({ success: false, message: 'Per KM rate must be >= 0' });
    }

    if (updateData.supportPhone !== undefined) {
      const p = updateData.supportPhone.trim();
      if (p && !p.startsWith('+'))
        return res.status(400).json({ success: false, message: 'Support phone must include country code (e.g. +971)' });
    }

    if (updateData.supportWhatsapp !== undefined) {
      const w = updateData.supportWhatsapp.trim();
      if (w && !w.startsWith('+'))
        return res.status(400).json({ success: false, message: 'WhatsApp number must include country code (e.g. +971)' });
    }

    if (updateData.address !== undefined) {
      const addr = updateData.address;
      if (addr.lat !== undefined && addr.lat !== null) {
        const lat = Number(addr.lat);
        if (isNaN(lat) || lat < -90 || lat > 90)
          return res.status(400).json({ success: false, message: 'Invalid latitude (must be -90 to 90)' });
      }
      if (addr.lng !== undefined && addr.lng !== null) {
        const lng = Number(addr.lng);
        if (isNaN(lng) || lng < -180 || lng > 180)
          return res.status(400).json({ success: false, message: 'Invalid longitude (must be -180 to 180)' });
      }
    }

    // ── Apply updates ──────────────────────────────────────────────────────
    if (!superAdmin.settings) superAdmin.settings = {};

    // String fields
    const stringFields = [
      'appName', 'supportEmail', 'supportPhone', 'supportWhatsapp',
      'stripePublicKey', 'stripeSecretKey'
    ];
    stringFields.forEach(f => {
      if (updateData[f] !== undefined)
        superAdmin.settings[f] = updateData[f].trim();
    });

    // Numeric (float) fields
    const floatFields = [
      'platformCommission', 'agencyCommission', 'taxRate',
      'deliveryCharge', 'freeDeliveryThreshold', 'perKmRate'
    ];
    floatFields.forEach(f => {
      if (updateData[f] !== undefined)
        superAdmin.settings[f] = Number(updateData[f]);
    });

    // Numeric (int) fields
    if (updateData.maxActiveOrdersPerDeliveryBoy !== undefined)
      superAdmin.settings.maxActiveOrdersPerDeliveryBoy =
        Number(updateData.maxActiveOrdersPerDeliveryBoy);

    // ✅ Address — includes buildingName
    if (updateData.address !== undefined) {
      superAdmin.settings.address = buildAddressFromData(updateData.address);
      console.log('📍 Address saved:', superAdmin.settings.address);
    }

    // Must call markModified for nested objects
    superAdmin.markModified('settings');
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

// ══════════════════════════════════════════════════════════════════════════════
// POST /super-admin/settings/:superAdminId/reset
// ══════════════════════════════════════════════════════════════════════════════
exports.resetSuperAdminSettings = async (req, res) => {
  try {
    const { superAdminId } = req.params;
    console.log('🔄 Resetting settings for super admin:', superAdminId);

    const superAdmin = await SuperAdmin.findById(superAdminId);

    if (!superAdmin) {
      return res.status(404).json({
        success: false,
        message: 'Super admin not found'
      });
    }

    superAdmin.settings = DEFAULT_SETTINGS;   // ✅ includes buildingName in address
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