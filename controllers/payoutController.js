const Payment = require('../models/Payment');
const Shop = require('../models/Shop');
const Order = require('../models/Order');
const DeliveryBoy = require('../models/DeliveryBoy');
const DeliveryAgency = require('../models/DeliveryAgency');
const AgencyPayout = require('../models/AgencyPayout');


const PLATFORM_COMMISSION_PERCENT = 5; // Example: 5% commission

exports.multiShopPayoutSummary = async (req, res) => {
  try {
    let { from, to } = req.query;

    let filter = { paymentStatus: 'Paid' };

    if (from && to) {
      filter.createdAt = {
        $gte: new Date(from),
        $lte: new Date(to)
      };
    }

    const payments = await Payment.find(filter);

    // Group by Shop
    const shopPayouts = {};

    payments.forEach(payment => {
      if (!payment.shopId) return; // Ignore if shopId missing

      if (!shopPayouts[payment.shopId]) {
        shopPayouts[payment.shopId] = {
          shopId: payment.shopId,
          totalSales: 0
        };
      }
      shopPayouts[payment.shopId].totalSales += payment.amount;
    });

    // Calculate commission and payout
    const payoutReport = [];

    for (const shopId in shopPayouts) {
      const shopData = shopPayouts[shopId];

      const commission = (shopData.totalSales * PLATFORM_COMMISSION_PERCENT) / 100;
      const netPayable = shopData.totalSales - commission;

      payoutReport.push({
        shopId,
        totalSales: shopData.totalSales.toFixed(2),
        platformCommission: commission.toFixed(2),
        netPayableToShop: netPayable.toFixed(2)
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



exports.agencyPayoutSummary = async (req, res) => {
  try {
    const { from, to } = req.query;

    const dateFilter = from && to
      ? {
          createdAt: {
            $gte: new Date(from),
            $lte: new Date(to)
          }
        }
      : {};

    // Get all delivered orders in range
    const deliveredOrders = await Order.find({
      orderStatus: 'Delivered',
      ...dateFilter
    });

    // Map: agencyId => [orders]
    const agencyOrders = {};

    for (let order of deliveredOrders) {
      if (!order.assignedDeliveryBoy) continue;

      const deliveryBoy = await DeliveryBoy.findById(order.assignedDeliveryBoy);
      if (!deliveryBoy || !deliveryBoy.agencyId) continue;

      const agencyId = deliveryBoy.agencyId.toString();
      if (!agencyOrders[agencyId]) {
        agencyOrders[agencyId] = [];
      }
      agencyOrders[agencyId].push(order);
    }

    // Build payout per agency
    const payoutReport = [];

    for (const agencyId in agencyOrders) {
      const orders = agencyOrders[agencyId];
      const totalDeliveries = orders.length;

      // Assuming fixed 1 delivery = 15 AED
      const perDeliveryRate = 15;
      const totalAmount = totalDeliveries * perDeliveryRate;

      const commission = (totalAmount * PLATFORM_COMMISSION_PERCENT) / 100;
      const netPayable = totalAmount - commission;

      payoutReport.push({
        agencyId,
        totalDeliveries,
        totalAmount: totalAmount.toFixed(2),
        commission: commission.toFixed(2),
        netPayable: netPayable.toFixed(2)
      });
    }

    return res.status(200).json({
      message: 'Agency Payout Summary',
      success: true,
      data: payoutReport
    });

  } catch (error) {
    console.error('Agency Payout Summary Error:', error);
    res.status(500).json({
      message: 'Failed to generate agency payout report',
      success: false,
      data: error.message
    });
  }
};



exports.getPendingPayoutsByAgency = async (req, res) => {
  try {
    const { agencyId } = req.params;

    const pending = await AgencyPayout.find({ agencyId, status: 'Pending' });

    res.status(200).json({
      message: 'Pending payouts fetched',
      success: true,
      data: pending
    });
  } catch (err) {
    res.status(500).json({
      message: 'Failed to fetch pending payouts',
      success: false,
      data: err.message
    });
  }
};



exports.markPayoutAsPaid = async (req, res) => {
  try {
    const { payoutId } = req.params;

    const updated = await AgencyPayout.findByIdAndUpdate(payoutId, { status: 'Paid' }, { new: true });

    res.status(200).json({
      message: 'Payout marked as Paid',
      success: true,
      data: updated
    });
  } catch (err) {
    res.status(500).json({
      message: 'Failed to mark payout',
      success: false,
      data: err.message
    });
  }
};