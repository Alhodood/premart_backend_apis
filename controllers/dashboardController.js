const Order = require('../models/Order');
const User = require('../models/User');

exports.getSuperAdminDashboard = async (req, res) => {
  try {
    console.log('📊 Fetching Super Admin Dashboard Analytics');

    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(currentMonthStart);
    lastMonthStart.setMonth(currentMonthStart.getMonth() - 1);

    const formatMonth = (date) =>
      date.toLocaleString('default', { month: 'long', year: 'numeric' });
    const lastMonthLabel = formatMonth(lastMonthStart);

    const getGrowth = (current, previous) => {
      if (previous === 0 && current === 0) return `0%`;
      const change = previous === 0 ? 100 : ((current - previous) / previous) * 100;
      return `${Math.round(Math.abs(change))}%`;
    };

    const [totalOrders, previousOrders] = await Promise.all([
      Order.countDocuments({ createdAt: { $gte: currentMonthStart } }),
      Order.countDocuments({
        createdAt: { $gte: lastMonthStart, $lt: currentMonthStart },
      }),
    ]);

    const [thisSales, lastSales] = await Promise.all([
      Order.aggregate([
        { $match: { createdAt: { $gte: currentMonthStart } } },
        {
          $group: {
            _id: null,
            total: {
              $sum: {
                $cond: [
                  { $eq: [{ $type: '$totalPayable' }, 'string'] },
                  { $toDouble: '$totalPayable' },
                  { $ifNull: ['$totalPayable', 0] },
                ],
              },
            },
          },
        },
      ]),
      Order.aggregate([
        {
          $match: {
            createdAt: { $gte: lastMonthStart, $lt: currentMonthStart },
          },
        },
        {
          $group: {
            _id: null,
            total: {
              $sum: {
                $cond: [
                  { $eq: [{ $type: '$totalPayable' }, 'string'] },
                  { $toDouble: '$totalPayable' },
                  { $ifNull: ['$totalPayable', 0] },
                ],
              },
            },
          },
        },
      ]),
    ]);

    const totalSalesAmount = thisSales[0]?.total || 0;
    const previousSalesAmount = lastSales[0]?.total || 0;

    const [couponOrdersThisMonth, couponOrdersLastMonth] = await Promise.all([
      Order.countDocuments({
        createdAt: { $gte: currentMonthStart },
        'coupon.code': { $exists: true, $ne: null },
      }),
      Order.countDocuments({
        createdAt: { $gte: lastMonthStart, $lt: currentMonthStart },
        'coupon.code': { $exists: true, $ne: null },
      }),
    ]);

    let payableThisMonth = 0;
    let payableLastMonth = 0;
    try {
      const AgencyPayout = require('../models/AgencyPayout');
      const [agencyPayThisMonth, agencyPayLastMonth] = await Promise.all([
        AgencyPayout.aggregate([
          {
            $match: {
              createdAt: { $gte: currentMonthStart },
              status: { $in: ['Unpaid', 'Pending', 'Paid'] },
            },
          },
          { $group: { _id: null, total: { $sum: '$totalEarnings' } } },
        ]),
        AgencyPayout.aggregate([
          {
            $match: {
              createdAt: { $gte: lastMonthStart, $lt: currentMonthStart },
              status: { $in: ['Unpaid', 'Pending', 'Paid'] },
            },
          },
          { $group: { _id: null, total: { $sum: '$totalEarnings' } } },
        ]),
      ]);
      payableThisMonth = agencyPayThisMonth[0]?.total || 0;
      payableLastMonth = agencyPayLastMonth[0]?.total || 0;
    } catch (error) {
      console.log('⚠️ Agency payable calculation failed:', error.message);
    }

    let topSellingProductsTotalAmount = 0;
    let topSellingProductsLastAmount = 0;
    try {
      const topProductSalesCurrentMonthAgg = await Order.aggregate([
        {
          $match: {
            status: 'Delivered',
            createdAt: { $gte: currentMonthStart },
          },
        },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.shopProductId',
            totalAmount: {
              $sum: {
                $cond: [
                  { $eq: [{ $type: '$totalPayable' }, 'string'] },
                  { $toDouble: '$totalPayable' },
                  { $ifNull: ['$totalPayable', 0] },
                ],
              },
            },
            count: { $sum: '$items.quantity' },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 1 },
      ]);

      if (topProductSalesCurrentMonthAgg.length > 0) {
        topSellingProductsTotalAmount = topProductSalesCurrentMonthAgg[0].totalAmount || 0;
        const topProductSalesLastMonthAgg = await Order.aggregate([
          {
            $match: {
              status: 'Delivered',
              createdAt: { $gte: lastMonthStart, $lt: currentMonthStart },
            },
          },
          { $unwind: '$items' },
          {
            $match: {
              'items.shopProductId': topProductSalesCurrentMonthAgg[0]._id,
            },
          },
          {
            $group: {
              _id: '$items.shopProductId',
              totalAmount: {
                $sum: {
                  $cond: [
                    { $eq: [{ $type: '$totalPayable' }, 'string'] },
                    { $toDouble: '$totalPayable' },
                    { $ifNull: ['$totalPayable', 0] },
                  ],
                },
              },
            },
          },
        ]);
        topSellingProductsLastAmount = topProductSalesLastMonthAgg[0]?.totalAmount || 0;
      }
    } catch (error) {
      console.log('⚠️ Top products calculation failed:', error.message);
    }

    const totalVisitorsCount = await User.countDocuments({ role: 'CUSTOMER' });
    const [newVisitorsThisMonth, newVisitorsLastMonth] = await Promise.all([
      User.countDocuments({
        role: 'CUSTOMER',
        createdAt: { $gte: currentMonthStart },
      }),
      User.countDocuments({
        role: 'CUSTOMER',
        createdAt: { $gte: lastMonthStart, $lt: currentMonthStart },
      }),
    ]);

    const responseData = {
      totalSalesAmount: Math.round(totalSalesAmount).toString(),
      salesGrowth: getGrowth(totalSalesAmount, previousSalesAmount),
      salesDateCompared: lastMonthLabel,

      totalOrders,
      orderGrowth: getGrowth(totalOrders, previousOrders),
      orderDateCompared: lastMonthLabel,

      payableToAgencies: Math.round(payableThisMonth).toString(),
      payableToAgenciesGrowth: getGrowth(payableThisMonth, payableLastMonth),
      payableToAgenciesDateCompared: lastMonthLabel,

      topSellingProductsTotalAmount: Math.round(topSellingProductsTotalAmount).toString(),
      topSellingProductsGrowth: getGrowth(
        topSellingProductsTotalAmount,
        topSellingProductsLastAmount
      ),
      topSellingProductsDateCompared: lastMonthLabel,

      couponTotalUsageCount: couponOrdersThisMonth,
      couponGrowth: getGrowth(couponOrdersThisMonth, couponOrdersLastMonth),
      couponDateCompared: lastMonthLabel,

      totalVisitors: totalVisitorsCount,
      visitorGrowth: getGrowth(newVisitorsThisMonth, newVisitorsLastMonth),
      visitorDateCompared: lastMonthLabel,
    };

    res.status(200).json({
      message: 'Super Admin Dashboard Analytics',
      success: true,
      data: responseData,
    });
  } catch (err) {
    console.error('❌ Super Admin Dashboard Error:', err);
    res.status(500).json({
      message: 'Failed to fetch Super Admin Dashboard',
      success: false,
      error: err.message,
    });
  }
};

exports.getWeeklySales = async (req, res) => {
  try {
    console.log('📊 Fetching Weekly Sales Data');

    const { startDate, endDate } = req.query;
   let start, end;

if (startDate && endDate) {
  const startRaw = new Date(startDate);
  const endRaw = new Date(endDate);

  if (isNaN(startRaw) || isNaN(endRaw)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid date format',
    });
  }

  // Normalize strictly in UTC
  start = new Date(Date.UTC(
    startRaw.getUTCFullYear(),
    startRaw.getUTCMonth(),
    startRaw.getUTCDate(),
    0, 0, 0, 0
  ));

  end = new Date(Date.UTC(
    endRaw.getUTCFullYear(),
    endRaw.getUTCMonth(),
    endRaw.getUTCDate(),
    23, 59, 59, 999
  ));
} else {
  const now = new Date();

  end = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    23, 59, 59, 999
  ));

  start = new Date(end);
  start.setUTCDate(end.getUTCDate() - 6);
  start.setUTCHours(0, 0, 0, 0);
}

    console.log(`📅 Query range: ${start.toISOString()} to ${end.toISOString()}`);

    const weeklySales = await Order.aggregate([
      {
        $match: {
          status: 'Delivered',
          createdAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt',
              timezone: 'UTC',
            },
          },
          totalSales: {
            $sum: {
              $cond: [
                { $eq: [{ $type: '$totalPayable' }, 'string'] },
                { $toDouble: '$totalPayable' },
                { $ifNull: ['$totalPayable', 0] },
              ],
            },
          },
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    console.log('📊 Aggregation result:', JSON.stringify(weeklySales, null, 2));

    const salesMap = {};
    weeklySales.forEach((item) => {
      salesMap[item._id] = {
        totalSales: Math.round(item.totalSales),
        orderCount: item.orderCount,
      };
    });

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const msInDay = 24 * 60 * 60 * 1000;
const totalDays = Math.floor((end - start) / msInDay) + 1;

const salesByDay = [];

for (let i = 0; i < totalDays; i++) {
  const currentDate = new Date(start.getTime() + i * msInDay);

  const dateStr = currentDate.toISOString().split('T')[0];
  const dayData = salesMap[dateStr] || { totalSales: 0, orderCount: 0 };

  salesByDay.push({
    date: dateStr,
    day: dayNames[currentDate.getDay()],
    totalSales: dayData.totalSales,
    orderCount: dayData.orderCount,
  });
}

    console.log('✅ Final array:', JSON.stringify(salesByDay, null, 2));

    res.status(200).json({
      message: 'Weekly sales fetched successfully',
      success: true,
      data: salesByDay,
      dateRange: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
    });
  } catch (err) {
    console.error('❌ Weekly Sales Error:', err);
    res.status(500).json({
      message: 'Failed to fetch weekly sales',
      success: false,
      error: err.message,
    });
  }
};

exports.getOrderStatusDistribution = async (req, res) => {
  try {
    const orderStatuses = await Order.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    const formattedData = orderStatuses.map((item) => ({
      status: item._id || 'Unknown',
      count: item.count,
      percentage: 0,
    }));

    const total = formattedData.reduce((sum, item) => sum + item.count, 0);
    formattedData.forEach((item) => {
      item.percentage = total > 0 ? Math.round((item.count / total) * 100) : 0;
    });

    res.status(200).json({
      message: 'Order status distribution fetched successfully',
      success: true,
      data: formattedData,
    });
  } catch (err) {
    console.error('❌ Order Status Distribution Error:', err);
    res.status(500).json({
      message: 'Failed to fetch order status distribution',
      success: false,
      error: err.message,
    });
  }
};

exports.getShopDashboardByShopId = async (req, res) => {
  // Keep existing implementation
};