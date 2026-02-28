const { DeliveryAgency } = require('../models/DeliveryAgency');
const logger = require('../config/logger');

exports.registerAgency = async (req, res) => {
  try {
    const { agencyDetails } = req.body;
    logger.info('registerAgency: request received', { agencyName: agencyDetails?.agencyName });

    if (!agencyDetails || !agencyDetails.agencyName || !agencyDetails.agencyMail) {
      logger.warn('registerAgency: required fields missing');
      return res.status(400).json({
        message: 'Required agency fields missing',
        success: false,
        data: []
      });
    }

    const agency = new DeliveryAgency({ agencyDetails });
    await agency.save();

    logger.info('registerAgency: agency registered successfully', { id: agency._id });
    return res.status(201).json({
      message: 'Delivery agency registered successfully',
      success: true,
      data: agency
    });
  } catch (error) {
    logger.error('registerAgency: failed to register agency', { error });
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
    logger.info('updateAgency: request received', { agencyId });

    if (!agencyDetails) {
      logger.warn('updateAgency: no update data provided', { agencyId });
      return res.status(400).json({
        message: 'No update data provided',
        success: false,
      });
    }

    const setPayload = {};
    const allowedFields = [
      'agencyName', 'agencyAddress', 'agencyMail', 'agencyContact',
      'agencyLicenseNumber', 'agencyLicenseExpiry', 'licenseAuthority',
      'emiratesId', 'emiratesIdImage', 'trn', 'ownerDateOfBirth',
      'city', 'emirates', 'latitude', 'longitude', 'agencyLocation',
      'agencyLicenseImage', 'profileImage', 'supportMail', 'supportNumber',
      'termsAndCondition', 'payoutType',
    ];

    for (const field of allowedFields) {
      if (agencyDetails[field] !== undefined) {
        setPayload[`agencyDetails.${field}`] = agencyDetails[field];
      }
    }

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
      logger.warn('updateAgency: no valid fields to update', { agencyId });
      return res.status(400).json({
        message: 'No valid fields to update',
        success: false,
      });
    }

    const updatedAgency = await DeliveryAgency.findByIdAndUpdate(
      agencyId,
      { $set: setPayload },
      { new: true, runValidators: true }
    );

    if (!updatedAgency) {
      logger.warn('updateAgency: agency not found', { agencyId });
      return res.status(404).json({
        message: 'Agency not found',
        success: false,
      });
    }

    logger.info('updateAgency: agency updated successfully', { agencyId });
    return res.status(200).json({
      message: 'Agency updated successfully',
      success: true,
      data: updatedAgency,
    });
  } catch (err) {
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern || {})[0] || 'field';
      logger.warn('updateAgency: duplicate key violation', { field, error: err.message });
      return res.status(409).json({
        message: `Duplicate value: ${field} already exists`,
        success: false,
        data: err.message,
      });
    }
    logger.error('updateAgency: failed to update agency', { error: err });
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
    logger.info('deleteAgency: request received', { agencyId });

    const deleted = await DeliveryAgency.findByIdAndDelete(agencyId);
    if (!deleted) {
      logger.warn('deleteAgency: agency not found', { agencyId });
      return res.status(404).json({
        message: 'Agency not found',
        success: false
      });
    }

    logger.info('deleteAgency: agency deleted successfully', { agencyId });
    res.status(200).json({
      message: 'Agency deleted successfully',
      success: true
    });
  } catch (err) {
    logger.error('deleteAgency: failed to delete agency', { error: err });
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
    logger.info('searchAgencies: request received', { search, emiratesId, page, limit });

    let filter = {};
    if (search) {
      filter.$or = [
        { 'agencyDetails.agencyName':    { $regex: search, $options: 'i' } },
        { 'agencyDetails.agencyMail':    { $regex: search, $options: 'i' } },
        { 'agencyDetails.agencyContact': { $regex: search, $options: 'i' } },
        { 'agencyDetails.agencyAddress': { $regex: search, $options: 'i' } },
        { 'agencyDetails.agencyLocation':{ $regex: search, $options: 'i' } }
      ];
    }
    if (emiratesId) filter['agencyDetails.emiratesId'] = emiratesId;
    if (fromExpiry && toExpiry) {
      filter['agencyDetails.agencyLicenseExpiry'] = { $gte: fromExpiry, $lte: toExpiry };
    }

    const agencies = await DeliveryAgency.find(filter)
      .sort({ [sortBy]: sort === 'asc' ? 1 : -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await DeliveryAgency.countDocuments(filter);

    logger.info('searchAgencies: agencies fetched successfully', { count: agencies.length, total });
    res.status(200).json({
      message: 'Filtered agency list',
      success: true,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      data: agencies
    });
  } catch (err) {
    logger.error('searchAgencies: failed to search agencies', { error: err });
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
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const sort  = req.query.sort === 'asc' ? 1 : -1;
    logger.info('getAllAgencies: request received', { page, limit });

    const [agencies, total] = await Promise.all([
      DeliveryAgency.find()
        .sort({ createdAt: sort })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      DeliveryAgency.countDocuments(),
    ]);

    const simplifiedAgencies = agencies.map(agency => ({
      _id:                 agency._id,
      agencyName:          agency.agencyDetails?.agencyName,
      agencyAddress:       agency.agencyDetails?.agencyAddress,
      agencyMail:          agency.agencyDetails?.agencyMail,
      agencyContact:       agency.agencyDetails?.agencyContact,
      agencyLicenseNumber: agency.agencyDetails?.agencyLicenseNumber,
      agencyLicenseExpiry: agency.agencyDetails?.agencyLicenseExpiry,
      licenseAuthority:    agency.agencyDetails?.licenseAuthority,
      agencyLicenseImage:  agency.agencyDetails?.agencyLicenseImage,
      emiratesId:          agency.agencyDetails?.emiratesId,
      profileImage:        agency.agencyDetails?.profileImage,
      emiratesIdImage:     agency.agencyDetails?.emiratesIdImage,
      trn:                 agency.agencyDetails?.trn,
      city:                agency.agencyDetails?.city,
      emirates:            agency.agencyDetails?.emirates,
      profileImage:        agency.agencyDetails?.profileImage,
      supportMail:         agency.agencyDetails?.supportMail,
      supportNumber:       agency.agencyDetails?.supportNumber,
      payoutType:          agency.agencyDetails?.payoutType,
      agencyBankDetails:   agency.agencyDetails?.agencyBankDetails,
      bankName:            agency.agencyDetails?.agencyBankDetails?.bankName,
      accountNumber:       agency.agencyDetails?.agencyBankDetails?.accountNumber,
      ibanNumber:          agency.agencyDetails?.agencyBankDetails?.ibanNumber,
      branch:              agency.agencyDetails?.agencyBankDetails?.branch,
      swiftCode:           agency.agencyDetails?.agencyBankDetails?.swiftCode,
      isVerified:          agency.isVerified || false,
      createdAt:           agency.createdAt,
      updatedAt:           agency.updatedAt,
    }));

    logger.info('getAllAgencies: agencies fetched successfully', { count: simplifiedAgencies.length, total });
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
    logger.error('getAllAgencies: failed to fetch agencies', { error });
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch agencies',
      error: error.message,
    });
  }
};

exports.getAgenciesWithPayments = async (req, res) => {
  try {
    logger.info('getAgenciesWithPayments: request received');

    const agencies = await DeliveryAgency.find();
    const expandedAgencies = [];

    for (const agency of agencies) {
      const base = {
        _id:                 agency._id,
        agencyName:          agency.agencyDetails.agencyName,
        agencyAddress:       agency.agencyDetails.agencyAddress,
        agencyMail:          agency.agencyDetails.agencyMail,
        agencyContact:       agency.agencyDetails.agencyContact,
        agencyLicenseNumber: agency.agencyDetails.agencyLicenseNumber,
        agencyLicenseExpiry: agency.agencyDetails.agencyLicenseExpiry,
        emiratesId:          agency.agencyDetails.emiratesId,
        agencyLocation:      agency.agencyDetails.agencyLocation,
        agencyLicenseImage:  agency.agencyDetails.agencyLicenseImage,
        termsAndCondition:   agency.agencyDetails.termsAndCondition,
        supportMail:         agency.agencyDetails.supportMail,
        supportNumber:       agency.agencyDetails.supportNumber,
        payoutType:          agency.agencyDetails.payoutType,
        bankName:            agency.agencyDetails.agencyBankDetails?.bankName,
        accountNumber:       agency.agencyDetails.agencyBankDetails?.accountNumber,
      };

      if (agency.paymentRecords && agency.paymentRecords.length > 0) {
        for (const record of agency.paymentRecords) {
          expandedAgencies.push({
            ...base,
            amount:        record.amount,
            month:         record.month,
            paymentDate:   record.paymentDate,
            transactionId: record.transactionId,
            paymentMethod: record.paymentMethod,
            status:        record.status
          });
        }
      } else {
        expandedAgencies.push({
          ...base,
          amount: null, month: null, paymentDate: null,
          transactionId: null, paymentMethod: null, status: null
        });
      }
    }

    logger.info('getAgenciesWithPayments: fetched successfully', { count: expandedAgencies.length });
    return res.status(200).json({
      message: 'Agency details with payment records',
      success: true,
      total: expandedAgencies.length,
      data: expandedAgencies
    });
  } catch (err) {
    logger.error('getAgenciesWithPayments: failed to fetch agency payment details', { error: err });
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
    logger.info('getAgencySettings: request received', { agencyId });

    if (!agencyId) {
      logger.warn('getAgencySettings: agency ID missing');
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
      logger.warn('getAgencySettings: agency not found', { agencyId });
      return res.status(404).json({
        message: 'Agency not found',
        success: false,
        data: null
      });
    }

    const { password, ...settings } = agency.agencyDetails;

    logger.info('getAgencySettings: settings fetched successfully', { agencyId });
    return res.status(200).json({
      message: 'Settings fetched successfully',
      success: true,
      data: settings
    });
  } catch (error) {
    logger.error('getAgencySettings: failed to fetch settings', { error });
    return res.status(500).json({
      message: 'Failed to fetch settings',
      success: false,
      error: error.message
    });
  }
};

exports.updateAgencySettings = async (req, res) => {
  try {
    const { agencyId } = req.params;
    const updateData = req.body;
    logger.info('updateAgencySettings: request received', { agencyId, fields: Object.keys(updateData) });

    if (!agencyId) {
      logger.warn('updateAgencySettings: agency ID missing');
      return res.status(400).json({
        message: 'Agency ID is required',
        success: false,
        data: null
      });
    }

    const agency = await DeliveryAgency.findById(agencyId);
    if (!agency) {
      logger.warn('updateAgencySettings: agency not found', { agencyId });
      return res.status(404).json({
        message: 'Agency not found',
        success: false,
        data: null
      });
    }

    const allowedFields = [
      'agencyName', 'agencyAddress', 'agencyMail', 'agencyContact',
      'city', 'emirates', 'licenseAuthority', 'trn', 'supportMail',
      'supportNumber', 'agencyLicenseNumber', 'agencyLicenseExpiry', 'payoutType',
      'emiratesId',        // ✅ ADD
  'emiratesIdImage',   // ✅ ADD
  'agencyLicenseImage', // ✅ ADD (also missing)
  'agencyLocation',    // ✅ ADD (also missing)
  'profileImage'
    ];

    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        agency.agencyDetails[field] = updateData[field];
      }
    });

    await agency.save();

    const { password, ...settings } = agency.agencyDetails.toObject();

    logger.info('updateAgencySettings: settings updated successfully', { agencyId });
    return res.status(200).json({
      message: 'Settings updated successfully',
      success: true,
      data: settings
    });
  } catch (error) {
    logger.error('updateAgencySettings: failed to update settings', { error });
    return res.status(500).json({
      message: 'Failed to update settings',
      success: false,
      error: error.message
    });
  }
};

exports.resetAgencySettings = async (req, res) => {
  try {
    const { agencyId } = req.params;
    logger.info('resetAgencySettings: request received', { agencyId });

    if (!agencyId) {
      logger.warn('resetAgencySettings: agency ID missing');
      return res.status(400).json({
        message: 'Agency ID is required',
        success: false,
        data: null
      });
    }

    const agency = await DeliveryAgency.findById(agencyId);
    if (!agency) {
      logger.warn('resetAgencySettings: agency not found', { agencyId });
      return res.status(404).json({
        message: 'Agency not found',
        success: false,
        data: null
      });
    }

    agency.agencyDetails.supportMail   = '';
    agency.agencyDetails.supportNumber = '';
    agency.agencyDetails.payoutType    = 'monthly';
    await agency.save();

    const { password, ...settings } = agency.agencyDetails.toObject();

    logger.info('resetAgencySettings: settings reset successfully', { agencyId });
    return res.status(200).json({
      message: 'Settings reset successfully',
      success: true,
      data: settings
    });
  } catch (error) {
    logger.error('resetAgencySettings: failed to reset settings', { error });
    return res.status(500).json({
      message: 'Failed to reset settings',
      success: false,
      error: error.message
    });
  }
};

exports.getAgencyByDeliveryBoy = async (req, res) => {
  try {
    const { deliveryBoyId } = req.params;
    const DeliveryBoy = require('../models/DeliveryBoy');
    logger.info('getAgencyByDeliveryBoy: request received', { deliveryBoyId });

    const boy = await DeliveryBoy.findById(deliveryBoyId).select('agencyId').lean();
    if (!boy) {
      logger.warn('getAgencyByDeliveryBoy: delivery boy not found', { deliveryBoyId });
      return res.status(404).json({ success: false, message: 'Delivery boy not found' });
    }

    if (!boy.agencyId) {
      logger.warn('getAgencyByDeliveryBoy: no agency assigned to delivery boy', { deliveryBoyId });
      return res.status(404).json({ success: false, message: 'No agency assigned to this delivery boy' });
    }

    const agency = await DeliveryAgency.findById(boy.agencyId)
      .select(
        'agencyDetails.agencyName ' +
        'agencyDetails.agencyContact ' +
        'agencyDetails.agencyMail ' +
        'agencyDetails.agencyAddress ' +
        'agencyDetails.supportNumber ' +
        'agencyDetails.supportMail ' +
        'agencyDetails.profileImage'
      )
      .lean();

    if (!agency) {
      logger.warn('getAgencyByDeliveryBoy: agency not found', { agencyId: boy.agencyId });
      return res.status(404).json({ success: false, message: 'Agency not found' });
    }

    const d = agency.agencyDetails;

    logger.info('getAgencyByDeliveryBoy: agency contact fetched successfully', { deliveryBoyId, agencyId: boy.agencyId });
    return res.status(200).json({
      success: true,
      message: 'Agency contact fetched successfully',
      data: {
        agencyName:    d.agencyName    || '',
        agencyContact: d.agencyContact || d.supportNumber || '',
        agencyMail:    d.agencyMail    || d.supportMail   || '',
        agencyAddress: d.agencyAddress || '',
        profileImage:  d.profileImage  || '',
      },
    });
  } catch (err) {
    logger.error('getAgencyByDeliveryBoy: failed to fetch agency contact', { error: err });
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch agency contact',
      error: err.message,
    });
  }
};