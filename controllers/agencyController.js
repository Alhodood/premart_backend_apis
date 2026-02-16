const { DeliveryAgency } = require('../models/DeliveryAgency');

exports.registerAgency = async (req, res) => {
  try {
    const { agencyDetails } = req.body;

    if (!agencyDetails || !agencyDetails.agencyName || !agencyDetails.agencyMail) {
      return res.status(400).json({
        message: 'Required agency fields missing',
        success: false,
        data: []
      });
    }

    const agency = new DeliveryAgency({ agencyDetails });
    await agency.save();

    return res.status(201).json({
      message: 'Delivery agency registered successfully',
      success: true,
      data: agency
    });
  } catch (error) {
    console.error('Agency Register Error:', error);
    res.status(500).json({
      message: 'Failed to register agency',
      success: false,
      data: error.message
    });
  }
};




exports.updateAgency = async (req, res) => {
  try {
    const { agencyId } = req.params;
    const { agencyDetails } = req.body;

    if (!agencyDetails) {
      return res.status(400).json({
        message: 'No update data provided',
        success: false,
      });
    }

    // ── Build a $set map using dot-notation ───────────────────────────────
    // This updates ONLY the fields sent in the request.
    // Fields NOT included (email, password, role) are left completely untouched.
    const setPayload = {};

    const allowedFields = [
      'agencyName',
      'agencyAddress',
      'agencyMail',
      'agencyContact',
      'agencyLicenseNumber',
      'agencyLicenseExpiry',
      'licenseAuthority',
      'emiratesId',
      'emiratesIdImage',
      'trn',
      'ownerDateOfBirth',
      'city',
      'emirates',           // array
      'latitude',
      'longitude',
      'agencyLocation',
      'agencyLicenseImage',
      'profileImage',
      'supportMail',
      'supportNumber',
      'termsAndCondition',
      'payoutType',
    ];

    // Scalar / array fields
    for (const field of allowedFields) {
      if (agencyDetails[field] !== undefined) {
        setPayload[`agencyDetails.${field}`] = agencyDetails[field];
      }
    }

    // Bank details (nested object — spread each sub-field individually)
    if (agencyDetails.agencyBankDetails) {
      const bank = agencyDetails.agencyBankDetails;
      const bankFields = ['bankName', 'accountNumber', 'ibanNumber', 'branch', 'swiftCode'];
      for (const field of bankFields) {
        if (bank[field] !== undefined) {
          setPayload[`agencyDetails.agencyBankDetails.${field}`] = bank[field];
        }
      }
    }

    if (Object.keys(setPayload).length === 0) {
      return res.status(400).json({
        message: 'No valid fields to update',
        success: false,
      });
    }

    // ── Run update ────────────────────────────────────────────────────────
    const updatedAgency = await DeliveryAgency.findByIdAndUpdate(
      agencyId,
      { $set: setPayload },   // ✅ only touches what was sent
      { new: true, runValidators: true }
    );

    if (!updatedAgency) {
      return res.status(404).json({
        message: 'Agency not found',
        success: false,
      });
    }

    return res.status(200).json({
      message: 'Agency updated successfully',
      success: true,
      data: updatedAgency,
    });

  } catch (err) {
    console.error('❌ Update Agency Error:', err);

    // Give the client a readable error for duplicate-key violations
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern || {})[0] || 'field';
      return res.status(409).json({
        message: `Duplicate value: ${field} already exists`,
        success: false,
        data: err.message,
      });
    }

    return res.status(500).json({
      message: 'Failed to update agency',
      success: false,
      data: err.message,
    });
  }
};


exports.deleteAgency = async (req, res) => {
  try {
    const { agencyId } = req.params;

    const deleted = await DeliveryAgency.findByIdAndDelete(agencyId);

    if (!deleted) {
      return res.status(404).json({
        message: 'Agency not found',
        success: false
      });
    }

    res.status(200).json({
      message: 'Agency deleted successfully',
      success: true
    });

  } catch (err) {
    res.status(500).json({
      message: 'Failed to delete agency',
      success: false,
      data: err.message
    });
  }
};



exports.searchAgencies = async (req, res) => {
  try {
    const {
      search, emiratesId, fromExpiry, toExpiry,
      page = 1, limit = 10, sort = 'desc', sortBy = 'createdAt'
    } = req.query;

    let filter = {};

    if (search) {
      filter.$or = [
        { 'agencyDetails.agencyName': { $regex: search, $options: 'i' } },
        { 'agencyDetails.agencyMail': { $regex: search, $options: 'i' } },
        { 'agencyDetails.agencyContact': { $regex: search, $options: 'i' },
       },{ 'agencyDetails.agencyAddress': { $regex: search, $options: 'i' } },
       { 'agencyDetails.agencyLocation': { $regex: search, $options: 'i' } }
      ];
    }

    if (emiratesId) {
      filter['agencyDetails.emiratesId'] = emiratesId;
    }

    if (fromExpiry && toExpiry) {
      filter['agencyDetails.agencyLicenseExpiry'] = {
        $gte: fromExpiry,
        $lte: toExpiry
      };
    }

    const agencies = await DeliveryAgency.find(filter)
      .sort({ [sortBy]: sort === 'asc' ? 1 : -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await DeliveryAgency.countDocuments(filter);

    res.status(200).json({
      message: 'Filtered agency list',
      success: true,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      data: agencies
    });

  } catch (err) {
    res.status(500).json({
      message: 'Failed to search agencies',
      success: false,
      data: err.message
    });
  }
};



exports.getAllAgencies = async (req, res) => {
  try {
    const { DeliveryAgency } = require('../models/DeliveryAgency');

    // ── Query params with safe defaults ──────────────────────────────────
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const sort  = req.query.sort === 'asc' ? 1 : -1; // default: newest first

    // ── Fetch with guaranteed newest-first sort ───────────────────────────
    const [agencies, total] = await Promise.all([
      DeliveryAgency.find()
        .sort({ createdAt: sort })   // -1 = newest first (default)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),                     // lean() for faster reads (plain JS objects)
      DeliveryAgency.countDocuments(),
    ]);

    // ── Shape response ────────────────────────────────────────────────────
    const simplifiedAgencies = agencies.map(agency => ({
      _id:   agency._id,

      // Basic
      agencyName:    agency.agencyDetails?.agencyName,
      agencyAddress: agency.agencyDetails?.agencyAddress,
      agencyMail:    agency.agencyDetails?.agencyMail,
      agencyContact: agency.agencyDetails?.agencyContact,

      // License
      agencyLicenseNumber: agency.agencyDetails?.agencyLicenseNumber,
      agencyLicenseExpiry: agency.agencyDetails?.agencyLicenseExpiry,
      licenseAuthority:    agency.agencyDetails?.licenseAuthority,
      agencyLicenseImage:  agency.agencyDetails?.agencyLicenseImage,

      // Identity
      emiratesId:      agency.agencyDetails?.emiratesId,
      emiratesIdImage: agency.agencyDetails?.emiratesIdImage,
      trn:             agency.agencyDetails?.trn,

      // Location
      city:     agency.agencyDetails?.city,
      emirates: agency.agencyDetails?.emirates,

      // Profile
      profileImage: agency.agencyDetails?.profileImage,

      // Support
      supportMail:   agency.agencyDetails?.supportMail,
      supportNumber: agency.agencyDetails?.supportNumber,

      // Payout
      payoutType: agency.agencyDetails?.payoutType,

      // Bank details (nested + flattened for table convenience)
      agencyBankDetails: agency.agencyDetails?.agencyBankDetails,
      bankName:          agency.agencyDetails?.agencyBankDetails?.bankName,
      accountNumber:     agency.agencyDetails?.agencyBankDetails?.accountNumber,
      ibanNumber:        agency.agencyDetails?.agencyBankDetails?.ibanNumber,
      branch:            agency.agencyDetails?.agencyBankDetails?.branch,
      swiftCode:         agency.agencyDetails?.agencyBankDetails?.swiftCode,

      // Timestamps
      createdAt: agency.createdAt,
      updatedAt: agency.updatedAt,
    }));

    return res.status(200).json({
      success: true,
      message: 'All agencies fetched successfully',
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      data: simplifiedAgencies,
    });

  } catch (error) {
    console.error('❌ Get All Agencies Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch agencies',
      error: error.message,
    });
  }
};


exports.getAgenciesWithPayments = async (req, res) => {
  try {
    const agencies = await DeliveryAgency.find();

    // Flatten agencies based on multiple paymentRecords
    const expandedAgencies = [];

    for (const agency of agencies) {
      if (agency.paymentRecords && agency.paymentRecords.length > 0) {
        for (const record of agency.paymentRecords) {
          expandedAgencies.push({
            _id: agency._id,
            agencyName: agency.agencyDetails.agencyName,
            agencyAddress: agency.agencyDetails.agencyAddress,
            agencyMail: agency.agencyDetails.agencyMail,
            agencyContact: agency.agencyDetails.agencyContact,
            agencyLicenseNumber: agency.agencyDetails.agencyLicenseNumber,
            agencyLicenseExpiry: agency.agencyDetails.agencyLicenseExpiry,
            emiratesId: agency.agencyDetails.emiratesId,
            agencyLocation: agency.agencyDetails.agencyLocation,
            agencyLicenseImage: agency.agencyDetails.agencyLicenseImage,
            termsAndCondition: agency.agencyDetails.termsAndCondition,
            supportMail: agency.agencyDetails.supportMail,
            supportNumber: agency.agencyDetails.supportNumber,
            payoutType: agency.agencyDetails.payoutType,
            bankName: agency.agencyDetails.agencyBankDetails?.bankName,
            accountNumber: agency.agencyDetails.agencyBankDetails?.accountNumber,
            amount: record.amount,
            month: record.month,
            paymentDate: record.paymentDate,
            transactionId: record.transactionId,
            paymentMethod: record.paymentMethod,
            status: record.status
          });
        }
      } else {
        // Push agency without payments
        expandedAgencies.push({
          _id: agency._id,
          agencyName: agency.agencyDetails.agencyName,
          agencyAddress: agency.agencyDetails.agencyAddress,
          agencyMail: agency.agencyDetails.agencyMail,
          agencyContact: agency.agencyDetails.agencyContact,
          agencyLicenseNumber: agency.agencyDetails.agencyLicenseNumber,
          agencyLicenseExpiry: agency.agencyDetails.agencyLicenseExpiry,
          emiratesId: agency.agencyDetails.emiratesId,
          agencyLocation: agency.agencyDetails.agencyLocation,
          agencyLicenseImage: agency.agencyDetails.agencyLicenseImage,
          termsAndCondition: agency.agencyDetails.termsAndCondition,
          supportMail: agency.agencyDetails.supportMail,
          supportNumber: agency.agencyDetails.supportNumber,
          payoutType: agency.agencyDetails.payoutType,
          bankName: agency.agencyDetails.agencyBankDetails?.bankName,
          accountNumber: agency.agencyDetails.agencyBankDetails?.accountNumber,
          amount: null,
          month: null,
          paymentDate: null,
          transactionId: null,
          paymentMethod: null,
          status: null
        });
      }
    }

    return res.status(200).json({
      message: 'Agency details with payment records',
      success: true,
      total: expandedAgencies.length,
      data: expandedAgencies
    });

  } catch (err) {
    console.error('Get Agencies With Payments Error:', err);
    return res.status(500).json({
      message: 'Failed to fetch agency payment details',
      success: false,
      data: err.message
    });
  }
};

exports.getAgencySettings = async (req, res) => {
  try {
    const { agencyId } = req.params;

    console.log('📋 Fetching settings for agency:', agencyId);

    if (!agencyId) {
      return res.status(400).json({
        message: 'Agency ID is required',
        success: false,
        data: null
      });
    }

    const agency = await DeliveryAgency.findById(agencyId)
      .select('agencyDetails')
      .lean();

    if (!agency) {
      return res.status(404).json({
        message: 'Agency not found',
        success: false,
        data: null
      });
    }

    // ✅ Return agency settings (excluding password)
    const { password, ...settings } = agency.agencyDetails;

    console.log('✅ Settings fetched successfully');

    return res.status(200).json({
      message: 'Settings fetched successfully',
      success: true,
      data: settings
    });

  } catch (error) {
    console.error('❌ Get Agency Settings Error:', error);
    return res.status(500).json({
      message: 'Failed to fetch settings',
      success: false,
      error: error.message
    });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// UPDATE AGENCY SETTINGS
// ═══════════════════════════════════════════════════════════════════════════

exports.updateAgencySettings = async (req, res) => {
  try {
    const { agencyId } = req.params;
    const updateData = req.body;

    console.log('🔄 Updating settings for agency:', agencyId);
    console.log('📦 Update data:', JSON.stringify(updateData, null, 2));

    if (!agencyId) {
      return res.status(400).json({
        message: 'Agency ID is required',
        success: false,
        data: null
      });
    }

    const agency = await DeliveryAgency.findById(agencyId);

    if (!agency) {
      return res.status(404).json({
        message: 'Agency not found',
        success: false,
        data: null
      });
    }

    // ✅ Fields that can be updated
    const allowedFields = [
      'agencyName',
      'agencyAddress',
      'agencyMail',
      'agencyContact',
      'city',
      'emirates',
      'licenseAuthority',
      'trn',
      'supportMail',
      'supportNumber',
      'agencyLicenseNumber',
      'agencyLicenseExpiry',
      'payoutType',
    ];

    // ✅ Update only allowed fields
    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        agency.agencyDetails[field] = updateData[field];
      }
    });

    await agency.save();

    console.log('✅ Settings updated successfully');

    // ✅ Return updated settings (excluding password)
    const { password, ...settings } = agency.agencyDetails.toObject();

    return res.status(200).json({
      message: 'Settings updated successfully',
      success: true,
      data: settings
    });

  } catch (error) {
    console.error('❌ Update Agency Settings Error:', error);
    return res.status(500).json({
      message: 'Failed to update settings',
      success: false,
      error: error.message
    });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// RESET AGENCY SETTINGS (Optional - if you want a reset feature)
// ═══════════════════════════════════════════════════════════════════════════

exports.resetAgencySettings = async (req, res) => {
  try {
    const { agencyId } = req.params;

    console.log('🔄 Resetting settings for agency:', agencyId);

    if (!agencyId) {
      return res.status(400).json({
        message: 'Agency ID is required',
        success: false,
        data: null
      });
    }

    const agency = await DeliveryAgency.findById(agencyId);

    if (!agency) {
      return res.status(404).json({
        message: 'Agency not found',
        success: false,
        data: null
      });
    }

    // ✅ Reset to default values (keep critical fields like email, password, license)
    // Only reset configurable settings
    agency.agencyDetails.supportMail = '';
    agency.agencyDetails.supportNumber = '';
    agency.agencyDetails.payoutType = 'monthly';

    await agency.save();

    console.log('✅ Settings reset successfully');

    const { password, ...settings } = agency.agencyDetails.toObject();

    return res.status(200).json({
      message: 'Settings reset successfully',
      success: true,
      data: settings
    });

  } catch (error) {
    console.error('❌ Reset Agency Settings Error:', error);
    return res.status(500).json({
      message: 'Failed to reset settings',
      success: false,
      error: error.message
    });
  }
};