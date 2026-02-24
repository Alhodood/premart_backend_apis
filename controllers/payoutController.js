const Payment = require('../models/Payment');
const { Shop } = require('../models/Shop');
const Order = require('../models/Order');
const DeliveryBoy = require('../models/DeliveryBoy');
const { DeliveryAgency } = require('../models/DeliveryAgency');
const AgencyPayout = require('../models/AgencyPayout');
const ShopPayout = require('../models/ShopPayout');
const { getSuperAdminSettings } = require('../helper/settingsHelper');
const { notifyShopPayout, notifyAgencyPayment } = require('./bellNotifications');
const logger = require('../config/logger'); // ← only addition at top

exports.multiShopPayoutSummary = async (req, res) => {
  try {
    const settings = await getSuperAdminSettings();
    const PLATFORM_COMMISSION_PERCENT = settings.platformCommission;

    let { from, to } = req.query;
    let filter = { paymentStatus: 'Paid' };
    if (from && to) {
      filter.createdAt = { $gte: new Date(from), $lte: new Date(to) };
    } else {
      from = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      to = new Date();
      filter.createdAt = { $gte: from, $lte: to };
    }

    const payments = await Payment.find(filter);
    const shopPayouts = {};
    payments.forEach(payment => {
      if (!payment.shopId) return;
      if (!shopPayouts[payment.shopId]) shopPayouts[payment.shopId] = { shopId: payment.shopId, totalSales: 0, totalOrders: 0 };
      shopPayouts[payment.shopId].totalSales += payment.amount;
      shopPayouts[payment.shopId].totalOrders += 1;
    });

    const payoutReport = [];
    for (const shopId in shopPayouts) {
      const shopData = shopPayouts[shopId];
      const commission = (shopData.totalSales * PLATFORM_COMMISSION_PERCENT) / 100;
      const netPayable = shopData.totalSales - commission;

      const existingPayout = await ShopPayout.findOne({ shopId, from: { $lte: new Date(to) }, to: { $gte: new Date(from) }, status: 'Pending' });
      let payout;
      if (existingPayout) {
        existingPayout.totalOrders = shopData.totalOrders;
        existingPayout.totalSales = shopData.totalSales;
        existingPayout.platformCommission = commission;
        existingPayout.netPayable = netPayable;
        payout = await existingPayout.save();
      } else {
        payout = await ShopPayout.create({ shopId, totalOrders: shopData.totalOrders, totalSales: shopData.totalSales, platformCommission: commission, netPayable, from, to, status: 'Pending' });
      }

      payoutReport.push({ payoutId: payout._id, shopId, totalOrders: shopData.totalOrders, totalSales: shopData.totalSales.toFixed(2), platformCommission: commission.toFixed(2), netPayableToShop: netPayable.toFixed(2), status: payout.status });
    }

    return res.status(200).json({ message: 'Multi-Shop Payout Summary', success: true, data: payoutReport });
  } catch (error) {
    logger.error('multiShopPayoutSummary failed', { error: error.message, stack: error.stack }); // ← replaced console.error
    res.status(500).json({ message: 'Failed to generate payout report', success: false, data: error.message });
  }
};

exports.getShopPayoutHistory = async (req, res) => {
  try {
    const { shopId } = req.params;
    const payouts = await ShopPayout.find({ shopId }).sort({ createdAt: -1 }).populate('shopId', 'shopeDetails.shopName');
    res.status(200).json({ message: 'Shop payout history fetched', success: true, data: payouts });
  } catch (err) {
    logger.error('getShopPayoutHistory failed', { shopId: req.params.shopId, error: err.message, stack: err.stack }); // ← was missing before
    res.status(500).json({ message: 'Failed to fetch payout history', success: false, data: err.message });
  }
};

exports.getAllAgencyPayouts = async (req, res) => {
  try {
    const { agencyId, status, month, year, from, to } = req.query;
    const filter = {};
    if (agencyId) filter.agencyId = agencyId;
    if (status) filter.status = status;
    if (month && year) filter.month = `${month} ${year}`;
    if (from && to) { filter.from = { $gte: new Date(from) }; filter.to = { $lte: new Date(to) }; }

    const payouts = await AgencyPayout.find(filter).populate('agencyId', 'agencyDetails').populate('deliveryBoyId', 'name phone').sort({ createdAt: -1 });
    const formatted = payouts.map(payout => ({
      payoutId: payout._id, agencyId: payout.agencyId._id,
      agencyName: payout.agencyId?.agencyDetails?.agencyName || 'N/A',
      contactNumber: payout.agencyId?.agencyDetails?.contactNumber || 'N/A',
      deliveryBoy: payout.deliveryBoyId ? { id: payout.deliveryBoyId._id, name: payout.deliveryBoyId.name, phone: payout.deliveryBoyId.phone } : null,
      totalOrders: payout.totalOrders, totalEarnings: payout.totalEarnings, month: payout.month,
      from: payout.from, to: payout.to, status: payout.status, transactionId: payout.transactionId,
      paidAt: payout.paidAt, paymentMethod: payout.paymentMethod, createdAt: payout.createdAt
    }));
    return res.status(200).json({ message: 'Agency payouts fetched successfully', success: true, count: formatted.length, data: formatted });
  } catch (error) {
    logger.error('getAllAgencyPayouts failed', { agencyId: req.query.agencyId, error: error.message, stack: error.stack }); // ← replaced console.error
    return res.status(500).json({ message: 'Failed to fetch agency payouts', success: false, error: error.message });
  }
};

exports.getAgencyPayoutById = async (req, res) => {
  try {
    const { agencyId } = req.params;
    const { status, month } = req.query;
    const filter = { agencyId };
    if (status) filter.status = status;
    if (month) filter.month = { $regex: month, $options: 'i' };

    const payouts = await AgencyPayout.find(filter).populate('agencyId', 'agencyDetails').sort({ createdAt: -1 });
    if (!payouts.length) return res.status(404).json({ success: false, message: 'No payouts found' });

    const agency = payouts[0].agencyId?.agencyDetails || {};
    const totalEarnings = payouts.reduce((s, p) => s + (p.totalEarnings || 0), 0);
    const totalOrders = payouts.reduce((s, p) => s + (p.totalOrders || 0), 0);
    const totalPending = payouts.filter(p => p.status === 'Pending').reduce((s, p) => s + (p.totalEarnings || 0), 0);
    const totalPaid = payouts.filter(p => p.status === 'Paid').reduce((s, p) => s + (p.totalEarnings || 0), 0);

    return res.status(200).json({
      success: true,
      data: [{ agencyId: payouts[0].agencyId?._id, agencyName: agency.agencyName || 'N/A', email: agency.email || 'N/A', contactNumber: agency.contactNumber || 'N/A', totalOrders, totalEarnings: Number(totalEarnings.toFixed(2)), totalPending: Number(totalPending.toFixed(2)), totalPaid: Number(totalPaid.toFixed(2)), from: payouts[payouts.length - 1]?.createdAt, to: payouts[0]?.createdAt }]
    });
  } catch (error) {
    logger.error('getAgencyPayoutById failed', { agencyId: req.params.agencyId, error: error.message, stack: error.stack }); // ← replaced console.error
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.markAgencyPayoutAsPaid = async (req, res) => {
  try {
    const { payoutId } = req.params;
    const { transactionId, paymentMethod, notes } = req.body;
    const payout = await AgencyPayout.findById(payoutId);
    if (!payout) return res.status(404).json({ message: 'Payout not found', success: false });
    if (payout.status === 'Paid') return res.status(400).json({ message: 'This payout has already been marked as paid', success: false, data: payout });

    payout.status = 'Paid';
    payout.paidAt = new Date();
    if (transactionId) payout.transactionId = transactionId;
    if (paymentMethod) payout.paymentMethod = paymentMethod;
    if (notes) payout.notes = notes;
    await payout.save();
    await notifyAgencyPayment(payout, payout.agencyId);

    return res.status(200).json({ message: 'Agency payout marked as paid successfully', success: true, data: payout });
  } catch (error) {
    logger.error('markAgencyPayoutAsPaid failed', { payoutId: req.params.payoutId, error: error.message, stack: error.stack }); // ← replaced console.error
    return res.status(500).json({ message: 'Failed to mark agency payout as paid', success: false, error: error.message });
  }
};

exports.getAllShopPayouts = async (req, res) => {
  try {
    const { shopId, status, from, to } = req.query;
    const filter = {};
    if (shopId) filter.shopId = shopId;
    if (status) filter.status = status;
    if (from && to) { filter.from = { $gte: new Date(from) }; filter.to = { $lte: new Date(to) }; }

    const payouts = await ShopPayout.find(filter).populate('shopId', 'shopeDetails.shopName shopeDetails.shopContact').sort({ createdAt: -1 });
    const formatted = payouts.map(payout => ({
      payoutId: payout._id, shopId: payout.shopId._id,
      shopName: payout.shopId?.shopeDetails?.shopName || 'N/A',
      shopContact: payout.shopId?.shopeDetails?.shopContact || 'N/A',
      totalOrders: payout.totalOrders, totalSales: payout.totalSales,
      platformCommission: payout.platformCommission, netPayable: payout.netPayable,
      from: payout.from, to: payout.to, status: payout.status,
      transactionId: payout.transactionId, paidAt: payout.paidAt, paymentMethod: 'COD', createdAt: payout.createdAt
    }));
    return res.status(200).json({ message: 'Shop payouts fetched successfully', success: true, count: formatted.length, data: formatted });
  } catch (error) {
    logger.error('getAllShopPayouts failed', { shopId: req.query.shopId, error: error.message, stack: error.stack }); // ← replaced console.error
    return res.status(500).json({ message: 'Failed to fetch shop payouts', success: false, error: error.message });
  }
};

exports.getShopPayoutById = async (req, res) => {
  try {
    const { shopId } = req.params;
    const { status, from, to } = req.query;
    const filter = { shopId };
    if (status) filter.status = status;
    if (from && to) { filter.from = { $gte: new Date(from) }; filter.to = { $lte: new Date(to) }; }

    const payouts = await ShopPayout.find(filter).populate('shopId', 'shopeDetails').sort({ createdAt: -1 });
    if (!payouts || payouts.length === 0) return res.status(404).json({ message: 'No payouts found for this shop', success: false });

    const totalSales = payouts.reduce((sum, p) => sum + p.totalSales, 0);
    const totalCommission = payouts.reduce((sum, p) => sum + p.platformCommission, 0);
    const totalNetPayable = payouts.reduce((sum, p) => sum + p.netPayable, 0);
    const totalPending = payouts.filter(p => p.status === 'Pending').reduce((sum, p) => sum + p.netPayable, 0);
    const totalPaid = payouts.filter(p => p.status === 'Paid').reduce((sum, p) => sum + p.netPayable, 0);
    const formattedPayouts = payouts.map(payout => ({ _id: payout._id, totalOrders: payout.totalOrders || 0, totalSales: payout.totalSales || 0, platformCommission: payout.platformCommission || 0, netPayable: payout.netPayable || 0, status: payout.status || 'Pending', from: payout.from, to: payout.to, createdAt: payout.createdAt, updatedAt: payout.updatedAt }));
    const shopDetails = payouts[0].shopId?.shopeDetails || {};

    return res.status(200).json({
      message: 'Shop payouts fetched successfully', success: true,
      data: { shopId: payouts[0].shopId._id, shopName: shopDetails.shopName || 'N/A', shopAddress: shopDetails.shopAddress || 'N/A', shopMail: shopDetails.shopMail || 'N/A', shopContact: shopDetails.shopContact || 'N/A', shopLicenseNumber: shopDetails.shopLicenseNumber || 'N/A', summary: { totalSales: totalSales.toFixed(2), totalCommission: totalCommission.toFixed(2), totalNetPayable: totalNetPayable.toFixed(2), totalPending: totalPending.toFixed(2), totalPaid: totalPaid.toFixed(2) }, payouts: formattedPayouts }
    });
  } catch (error) {
    logger.error('getShopPayoutById failed', { shopId: req.params.shopId, error: error.message, stack: error.stack }); // ← replaced console.error
    return res.status(500).json({ message: 'Failed to fetch shop payout', success: false, error: error.message });
  }
};

exports.markShopPayoutAsPaid = async (req, res) => {
  try {
    const { payoutId } = req.params;
    const { transactionId, paymentMethod, notes } = req.body;
    const payout = await ShopPayout.findById(payoutId);
    if (!payout) return res.status(404).json({ message: 'Payout not found', success: false });
    if (payout.status === 'Paid') return res.status(400).json({ message: 'This payout has already been marked as paid', success: false, data: payout });

    payout.status = 'Paid';
    payout.paidAt = new Date();
    if (transactionId) payout.transactionId = transactionId;
    if (paymentMethod) payout.paymentMethod = paymentMethod;
    if (notes) payout.notes = notes;
    await payout.save();
    await notifyShopPayout(payout, payout.shopId);

    return res.status(200).json({ message: 'Shop payout marked as paid successfully', success: true, data: payout });
  } catch (error) {
    logger.error('markShopPayoutAsPaid failed', { payoutId: req.params.payoutId, error: error.message, stack: error.stack }); // ← replaced console.error
    return res.status(500).json({ message: 'Failed to mark shop payout as paid', success: false, error: error.message });
  }
};

exports.getPayoutSummary = async (req, res) => {
  try {
    const { month, year } = req.query;
    const agencyFilter = {};
    if (month && year) agencyFilter.month = `${month} ${year}`;
    const agencyPayouts = await AgencyPayout.find(agencyFilter);
    let totalAgencyPending = 0, totalAgencyPaid = 0;
    agencyPayouts.forEach(payout => {
      if (payout.status === 'Pending') totalAgencyPending += payout.totalEarnings;
      else if (payout.status === 'Paid') totalAgencyPaid += payout.totalEarnings;
    });

    const shopFilter = {};
    if (month && year) { const startDate = new Date(year, parseInt(month) - 1, 1); const endDate = new Date(year, parseInt(month), 0); shopFilter.from = { $gte: startDate }; shopFilter.to = { $lte: endDate }; }
    const shopPayouts = await ShopPayout.find(shopFilter);
    let totalShopPending = 0, totalShopPaid = 0;
    shopPayouts.forEach(payout => {
      if (payout.status === 'Pending') totalShopPending += payout.netPayable;
      else if (payout.status === 'Paid') totalShopPaid += payout.netPayable;
    });

    return res.status(200).json({
      message: 'Payout summary fetched successfully', success: true,
      data: { agencies: { totalPending: totalAgencyPending.toFixed(2), totalPaid: totalAgencyPaid.toFixed(2), total: (totalAgencyPending + totalAgencyPaid).toFixed(2), count: agencyPayouts.length }, shops: { totalPending: totalShopPending.toFixed(2), totalPaid: totalShopPaid.toFixed(2), total: (totalShopPending + totalShopPaid).toFixed(2), count: shopPayouts.length }, combined: { totalPending: (totalAgencyPending + totalShopPending).toFixed(2), totalPaid: (totalAgencyPaid + totalShopPaid).toFixed(2), grandTotal: (totalAgencyPending + totalAgencyPaid + totalShopPending + totalShopPaid).toFixed(2) } }
    });
  } catch (error) {
    logger.error('getPayoutSummary failed', { error: error.message, stack: error.stack }); // ← replaced console.error
    return res.status(500).json({ message: 'Failed to fetch payout summary', success: false, error: error.message });
  }
};