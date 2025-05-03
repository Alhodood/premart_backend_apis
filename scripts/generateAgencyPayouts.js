const mongoose = require('mongoose');
const Order = require('./models/Order');
const DeliveryBoy = require('./models/DeliveryBoy');
const AgencyPayout = require('./models/AgencyPayout');

const PER_DELIVERY_RATE = 15;
const COMMISSION_PERCENT = 5;

// Call this function with start and end date of month
async function generateAgencyPayouts(fromDateStr, toDateStr) {
  try {
    const from = new Date(fromDateStr);
    const to = new Date(toDateStr);

    console.log(`⏳ Generating agency payouts from ${fromDateStr} to ${toDateStr}`);

    // Step 1: Get all delivered orders in that period
    const orders = await Order.find({
      orderStatus: 'Delivered',
      createdAt: { $gte: from, $lte: to }
    });

    // Step 2: Map agencyId => list of orders
    const agencyDeliveries = {};

    for (let order of orders) {
      const boyId = order.assignedDeliveryBoy;
      if (!boyId) continue;

      const boy = await DeliveryBoy.findById(boyId);
      if (!boy || !boy.agencyId) continue;

      const agencyId = boy.agencyId.toString();
      if (!agencyDeliveries[agencyId]) agencyDeliveries[agencyId] = [];

      agencyDeliveries[agencyId].push(order);
    }

    // Step 3: Create AgencyPayout records
    for (const agencyId in agencyDeliveries) {
      const orders = agencyDeliveries[agencyId];
      const totalDeliveries = orders.length;
      const totalAmount = totalDeliveries * PER_DELIVERY_RATE;
      const commission = (totalAmount * COMMISSION_PERCENT) / 100;
      const netPayable = totalAmount - commission;

      const exists = await AgencyPayout.findOne({
        agencyId,
        from: fromDateStr,
        to: toDateStr
      });

      if (exists) {
        console.log(`⚠️ Payout for agency ${agencyId} already exists. Skipping...`);
        continue;
      }

      await AgencyPayout.create({
        agencyId,
        from: fromDateStr,
        to: toDateStr,
        totalDeliveries,
        totalAmount,
        commission,
        netPayable,
        status: 'Pending'
      });

      console.log(`✅ Payout created for agency ${agencyId}: AED ${netPayable.toFixed(2)}`);
    }

    console.log('🎉 All agency payouts generated successfully');

  } catch (err) {
    console.error('❌ Error generating payouts:', err.message);
  }
}

module.exports = generateAgencyPayouts;