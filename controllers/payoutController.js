const Payment = require('../models/Payment');
const { Shop } = require('../models/Shop');
const Order = require('../models/Order');
const DeliveryBoy = require('../models/DeliveryBoy');
const { DeliveryAgency } = require('../models/DeliveryAgency');
const AgencyPayout = require('../models/AgencyPayout');
const ShopPayout = require('../models/ShopPayout');

const PLATFORM_COMMISSION_PERCENT = 5; // Example: 5% commission

// ==========================================
// MULTI SHOP PAYOUT SUMMARY
// ==========================================

exports.multiShopPayoutSummary = async (req, res) => {
  try {
    let { from, to } = req.query;
    let filter = { paymentStatus: 'Paid' };
    
    if (from && to) {
      filter.createdAt = { $gte: new Date(from), $lte: new Date(to) };
    } else {
      // Default to current month
      from = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      to = new Date();
      filter.createdAt = { $gte: from, $lte: to };
    }

    const payments = await Payment.find(filter);
    
    // Group by Shop
    const shopPayouts = {};
    payments.forEach(payment => {
      if (!payment.shopId) return;
      if (!shopPayouts[payment.shopId]) {
        shopPayouts[payment.shopId] = {
          shopId: payment.shopId,
          totalSales: 0,
          totalOrders: 0
        };
      }
      shopPayouts[payment.shopId].totalSales += payment.amount;
      shopPayouts[payment.shopId].totalOrders += 1;
    });

    // Create payout records
    const payoutReport = [];
    for (const shopId in shopPayouts) {
      const shopData = shopPayouts[shopId];
      const commission = (shopData.totalSales * PLATFORM_COMMISSION_PERCENT) / 100;
      const netPayable = shopData.totalSales - commission;

      // ✅ CHECK IF PAYOUT ALREADY EXISTS FOR THIS DATE RANGE
      const existingPayout = await ShopPayout.findOne({
        shopId,
        from: { $lte: new Date(to) },
        to: { $gte: new Date(from) },
        status: { $in: ['Pending', 'Processing'] } // Only check unpaid payouts
      });

      let payout;
      if (existingPayout) {
        // Update existing pending payout
        existingPayout.totalOrders = shopData.totalOrders;
        existingPayout.totalSales = shopData.totalSales;
        existingPayout.platformCommission = commission;
        existingPayout.netPayable = netPayable;
        payout = await existingPayout.save();
      } else {
        // Create new payout record (only if no pending/processing payout exists)
        payout = await ShopPayout.create({
          shopId,
          totalOrders: shopData.totalOrders,
          totalSales: shopData.totalSales,
          platformCommission: commission,
          netPayable,
          from,
          to,
          status: 'Pending'
        });
      }

      payoutReport.push({
        payoutId: payout._id,
        shopId,
        totalOrders: shopData.totalOrders,
        totalSales: shopData.totalSales.toFixed(2),
        platformCommission: commission.toFixed(2),
        netPayableToShop: netPayable.toFixed(2),
        status: payout.status
      });
    }

    return res.status(200).json({
      message: 'Multi-Shop Payout Summary',
      success: true,
      data: payoutReport
    });
  } catch (error) {
    console.error('Multi-Shop Payout Error:', error);
    res.status(500).json({
      message: 'Failed to generate payout report',
      success: false,
      data: error.message
    });
  }
};

// ==========================================
// SHOP PAYOUT HISTORY
// ==========================================

exports.getShopPayoutHistory = async (req, res) => {
  try {
    const { shopId } = req.params;
    
    const payouts = await ShopPayout.find({ shopId })
      .sort({ createdAt: -1 })
      .populate('shopId', 'shopeDetails.shopName');

    res.status(200).json({
      message: 'Shop payout history fetched',
      success: true,
      data: payouts
    });
  } catch (err) {
    res.status(500).json({
      message: 'Failed to fetch payout history',
      success: false,
      data: err.message
    });
  }
};

// ==========================================
// AGENCY PAYOUT ENDPOINTS
// ==========================================

// Get all agency payouts (with filters)
exports.getAllAgencyPayouts = async (req, res) => {
  try {
    const { agencyId, status, month, year, from, to } = req.query;

    const filter = {};
    if (agencyId) filter.agencyId = agencyId;
    if (status) filter.status = status;
    
    // Filter by month/year
    if (month && year) {
      const targetMonth = `${month} ${year}`;
      filter.month = targetMonth;
    }

    // Filter by date range
    if (from && to) {
      filter.from = { $gte: new Date(from) };
      filter.to = { $lte: new Date(to) };
    }

    const payouts = await AgencyPayout.find(filter)
      .populate('agencyId', 'agencyDetails')
      .populate('deliveryBoyId', 'name phone')
      .sort({ createdAt: -1 });

    const formatted = payouts.map(payout => ({
      payoutId: payout._id,
      agencyId: payout.agencyId._id,
      agencyName: payout.agencyId?.agencyDetails?.agencyName || 'N/A',
      contactNumber: payout.agencyId?.agencyDetails?.contactNumber || 'N/A',
      deliveryBoy: payout.deliveryBoyId ? {
        id: payout.deliveryBoyId._id,
        name: payout.deliveryBoyId.name,
        phone: payout.deliveryBoyId.phone
      } : null,
      totalOrders: payout.totalOrders,
      totalEarnings: payout.totalEarnings,
      month: payout.month,
      from: payout.from,
      to: payout.to,
      status: payout.status,
      transactionId: payout.transactionId,
      paidAt: payout.paidAt,
      paymentMethod: payout.paymentMethod,
      createdAt: payout.createdAt
    }));

    return res.status(200).json({
      message: 'Agency payouts fetched successfully',
      success: true,
      count: formatted.length,
      data: formatted
    });

  } catch (error) {
    console.error('Get Agency Payouts Error:', error);
    return res.status(500).json({
      message: 'Failed to fetch agency payouts',
      success: false,
      error: error.message
    });
  }
};

// Get specific agency payout
exports.getAgencyPayoutById = async (req, res) => {
  try {
    const { agencyId } = req.params;
    const { status, month } = req.query;

    const filter = { agencyId };
    if (status) filter.status = status;
    if (month) filter.month = { $regex: month, $options: 'i' };

    const payouts = await AgencyPayout.find(filter)
      .populate('agencyId', 'agencyDetails')
      .populate('deliveryBoyId', 'name phone email')
      .sort({ createdAt: -1 });

    if (!payouts || payouts.length === 0) {
      return res.status(404).json({
        message: 'No payouts found for this agency',
        success: false
      });
    }

    // Calculate totals
    const totalEarnings = payouts.reduce((sum, p) => sum + p.totalEarnings, 0);
    const totalOrders = payouts.reduce((sum, p) => sum + p.totalOrders, 0);
    const totalPending = payouts.filter(p => p.status === 'Pending').reduce((sum, p) => sum + p.totalEarnings, 0);
    const totalPaid = payouts.filter(p => p.status === 'Paid').reduce((sum, p) => sum + p.totalEarnings, 0);

    return res.status(200).json({
      message: 'Agency payouts fetched successfully',
      success: true,
      data: {
        agencyId: payouts[0].agencyId._id,
        agencyName: payouts[0].agencyId?.agencyDetails?.agencyName || 'N/A',
        contactNumber: payouts[0].agencyId?.agencyDetails?.contactNumber || 'N/A',
        email: payouts[0].agencyId?.agencyDetails?.email || 'N/A',
        summary: {
          totalEarnings: totalEarnings.toFixed(2),
          totalOrders,
          totalPending: totalPending.toFixed(2),
          totalPaid: totalPaid.toFixed(2)
        },
        payouts
      }
    });

  } catch (error) {
    console.error('Get Agency Payout Error:', error);
    return res.status(500).json({
      message: 'Failed to fetch agency payout',
      success: false,
      error: error.message
    });
  }
};

// Mark agency payment as paid
exports.markAgencyPayoutAsPaid = async (req, res) => {
  try {
    const { payoutId } = req.params;
    const { transactionId, paymentMethod, notes } = req.body;

    const payout = await AgencyPayout.findById(payoutId);
    if (!payout) {
      return res.status(404).json({
        message: 'Payout not found',
        success: false
      });
    }

    // ✅ PREVENT UPDATING ALREADY PAID PAYOUTS
    if (payout.status === 'Paid') {
      return res.status(400).json({
        message: 'This payout has already been marked as paid',
        success: false,
        data: payout
      });
    }

    payout.status = 'Paid';
    payout.paidAt = new Date();
    if (transactionId) payout.transactionId = transactionId;
    if (paymentMethod) payout.paymentMethod = paymentMethod;
    if (notes) payout.notes = notes;

    await payout.save();

    return res.status(200).json({
      message: 'Agency payout marked as paid successfully',
      success: true,
      data: payout
    });

  } catch (error) {
    console.error('Mark Agency Payout Paid Error:', error);
    return res.status(500).json({
      message: 'Failed to mark agency payout as paid',
      success: false,
      error: error.message
    });
  }
};

// ==========================================
// SHOP PAYOUT ENDPOINTS
// ==========================================

// Get all shop payouts
exports.getAllShopPayouts = async (req, res) => {
  try {
    const { shopId, status, from, to } = req.query;

    const filter = {};
    if (shopId) filter.shopId = shopId;
    if (status) filter.status = status;
    if (from && to) {
      filter.from = { $gte: new Date(from) };
      filter.to = { $lte: new Date(to) };
    }

    const payouts = await ShopPayout.find(filter)
      .populate('shopId', 'shopeDetails.shopName shopeDetails.shopContact')
      .sort({ createdAt: -1 });

    const formatted = payouts.map(payout => ({
      payoutId: payout._id,
      shopId: payout.shopId._id,
      shopName: payout.shopId?.shopeDetails?.shopName || 'N/A',
      shopContact: payout.shopId?.shopeDetails?.shopContact || 'N/A',
      totalOrders: payout.totalOrders,
      totalSales: payout.totalSales,
      platformCommission: payout.platformCommission,
      netPayable: payout.netPayable,
      from: payout.from,
      to: payout.to,
      status: payout.status,
      transactionId: payout.transactionId,
      paidAt: payout.paidAt,
      paymentMethod: payout.paymentMethod,
      createdAt: payout.createdAt
    }));

    return res.status(200).json({
      message: 'Shop payouts fetched successfully',
      success: true,
      count: formatted.length,
      data: formatted
    });

  } catch (error) {
    console.error('Get Shop Payouts Error:', error);
    return res.status(500).json({
      message: 'Failed to fetch shop payouts',
      success: false,
      error: error.message
    });
  }
};

// Get specific shop payout
exports.getShopPayoutById = async (req, res) => {
  try {
    const { shopId } = req.params;
    const { status, from, to } = req.query;

    const filter = { shopId };
    if (status) filter.status = status;
    if (from && to) {
      filter.from = { $gte: new Date(from) };
      filter.to = { $lte: new Date(to) };
    }

    const payouts = await ShopPayout.find(filter)
      .populate('shopId', 'shopeDetails')
      .sort({ createdAt: -1 });

    if (!payouts || payouts.length === 0) {
      return res.status(404).json({
        message: 'No payouts found for this shop',
        success: false
      });
    }

    // Calculate totals
    const totalSales = payouts.reduce((sum, p) => sum + p.totalSales, 0);
    const totalCommission = payouts.reduce((sum, p) => sum + p.platformCommission, 0);
    const totalNetPayable = payouts.reduce((sum, p) => sum + p.netPayable, 0);
    const totalPending = payouts.filter(p => p.status === 'Pending').reduce((sum, p) => sum + p.netPayable, 0);
    const totalPaid = payouts.filter(p => p.status === 'Paid').reduce((sum, p) => sum + p.netPayable, 0);

    return res.status(200).json({
      message: 'Shop payouts fetched successfully',
      success: true,
      data: {
        shopId: payouts[0].shopId._id,
        shopName: payouts[0].shopId?.shopeDetails?.shopName || 'N/A',
        summary: {
          totalSales: totalSales.toFixed(2),
          totalCommission: totalCommission.toFixed(2),
          totalNetPayable: totalNetPayable.toFixed(2),
          totalPending: totalPending.toFixed(2),
          totalPaid: totalPaid.toFixed(2)
        },
        payouts
      }
    });

  } catch (error) {
    console.error('Get Shop Payout Error:', error);
    return res.status(500).json({
      message: 'Failed to fetch shop payout',
      success: false,
      error: error.message
    });
  }
};

// Mark shop payout as paid
exports.markShopPayoutAsPaid = async (req, res) => {
  try {
    const { payoutId } = req.params;
    const { transactionId, paymentMethod, notes } = req.body;

    const payout = await ShopPayout.findById(payoutId);
    if (!payout) {
      return res.status(404).json({
        message: 'Payout not found',
        success: false
      });
    }

    // ✅ PREVENT UPDATING ALREADY PAID PAYOUTS
    if (payout.status === 'Paid') {
      return res.status(400).json({
        message: 'This payout has already been marked as paid',
        success: false,
        data: payout
      });
    }

    payout.status = 'Paid';
    payout.paidAt = new Date();
    if (transactionId) payout.transactionId = transactionId;
    if (paymentMethod) payout.paymentMethod = paymentMethod;
    if (notes) payout.notes = notes;

    await payout.save();

    return res.status(200).json({
      message: 'Shop payout marked as paid successfully',
      success: true,
      data: payout
    });

  } catch (error) {
    console.error('Mark Shop Payout Paid Error:', error);
    return res.status(500).json({
      message: 'Failed to mark shop payout as paid',
      success: false,
      error: error.message
    });
  }
};

// ==========================================
// COMBINED REPORTS
// ==========================================

exports.getPayoutSummary = async (req, res) => {
  try {
    const { month, year } = req.query;

    // Agency payouts summary
    const agencyFilter = {};
    if (month && year) {
      agencyFilter.month = `${month} ${year}`;
    }

    const agencyPayouts = await AgencyPayout.find(agencyFilter);
    let totalAgencyPending = 0;
    let totalAgencyPaid = 0;

    agencyPayouts.forEach(payout => {
      if (payout.status === 'Pending') {
        totalAgencyPending += payout.totalEarnings;
      } else if (payout.status === 'Paid') {
        totalAgencyPaid += payout.totalEarnings;
      }
    });

    // Shop payouts summary
    const shopFilter = {};
    if (month && year) {
      const startDate = new Date(year, parseInt(month) - 1, 1);
      const endDate = new Date(year, parseInt(month), 0);
      shopFilter.from = { $gte: startDate };
      shopFilter.to = { $lte: endDate };
    }

    const shopPayouts = await ShopPayout.find(shopFilter);
    let totalShopPending = 0;
    let totalShopPaid = 0;

    shopPayouts.forEach(payout => {
      if (payout.status === 'Pending') {
        totalShopPending += payout.netPayable;
      } else if (payout.status === 'Paid') {
        totalShopPaid += payout.netPayable;
      }
    });

    return res.status(200).json({
      message: 'Payout summary fetched successfully',
      success: true,
      data: {
        agencies: {
          totalPending: totalAgencyPending.toFixed(2),
          totalPaid: totalAgencyPaid.toFixed(2),
          total: (totalAgencyPending + totalAgencyPaid).toFixed(2),
          count: agencyPayouts.length
        },
        shops: {
          totalPending: totalShopPending.toFixed(2),
          totalPaid: totalShopPaid.toFixed(2),
          total: (totalShopPending + totalShopPaid).toFixed(2),
          count: shopPayouts.length
        },
        combined: {
          totalPending: (totalAgencyPending + totalShopPending).toFixed(2),
          totalPaid: (totalAgencyPaid + totalShopPaid).toFixed(2),
          grandTotal: (totalAgencyPending + totalAgencyPaid + totalShopPending + totalShopPaid).toFixed(2)
        }
      }
    });

  } catch (error) {
    console.error('Get Payout Summary Error:', error);
    return res.status(500).json({
      message: 'Failed to fetch payout summary',
      success: false,
      error: error.message
    });
  }
};