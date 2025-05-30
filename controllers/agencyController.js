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

    const updatedAgency = await DeliveryAgency.findByIdAndUpdate(
      agencyId,
      { agencyDetails },
      { new: true }
    );

    if (!updatedAgency) {
      return res.status(404).json({
        message: 'Agency not found',
        success: false
      });
    }

    res.status(200).json({
      message: 'Agency updated successfully',
      success: true,
      data: updatedAgency
    });

  } catch (err) {
    res.status(500).json({
      message: 'Failed to update agency',
      success: false,
      data: err.message
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
    const { page = 1, limit = 20, sort = 'desc' } = req.query;

    const agencies = await DeliveryAgency.find()
      .sort({ createdAt: sort === 'asc' ? 1 : -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await DeliveryAgency.countDocuments();

    return res.status(200).json({
      message: 'All agencies fetched successfully',
      success: true,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      data: agencies
    });

  } catch (error) {
    console.error('Get All Agencies Error:', error);
    return res.status(500).json({
      message: 'Failed to fetch agencies',
      success: false,
      data: error.message
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