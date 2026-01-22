const Order = require('../models/Order');
const Product = require('../models/_deprecated/Product');
const Stock = require('../models/Stock');
const User = require('../models/User');
const DeliveryBoy = require('../models/DeliveryBoy');
const { DeliveryAgency } = require('../models/DeliveryAgency');

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

    // ==================== ORDERS ====================
    console.log('📦 Calculating orders...');
    const totalOrders = await Order.countDocuments({
      createdAt: { $gte: currentMonthStart }
    });
    const previousOrders = await Order.countDocuments({
      createdAt: { $gte: lastMonthStart, $lt: currentMonthStart }
    });
    console.log(`✅ Orders: Current=${totalOrders}, Previous=${previousOrders}`);

    // ==================== SALES ====================
    console.log('💰 Calculating sales...');
    const thisSales = await Order.aggregate([
      { $match: { createdAt: { $gte: currentMonthStart } } },
      {
        $group: {
          _id: null,
          total: {
            $sum: {
              $cond: [
                { $eq: [{ $type: '$totalPayable' }, 'string'] },
                { $toDouble: '$totalPayable' },
                { $ifNull: ['$totalPayable', 0] }
              ]
            }
          }
        }
      }
    ]);

    const lastSales = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: lastMonthStart, $lt: currentMonthStart }
        }
      },
      {
        $group: {
          _id: null,
          total: {
            $sum: {
              $cond: [
                { $eq: [{ $type: '$totalPayable' }, 'string'] },
                { $toDouble: '$totalPayable' },
                { $ifNull: ['$totalPayable', 0] }
              ]
            }
          }
        }
      }
    ]);

    const totalSalesAmount = thisSales[0]?.total || 0;
    const previousSalesAmount = lastSales[0]?.total || 0;
    console.log(`✅ Sales: Current=${totalSalesAmount}, Previous=${previousSalesAmount}`);

    // ==================== COUPON USAGE ====================
    console.log('🎟️ Calculating coupon usage...');
    const couponOrdersThisMonth = await Order.countDocuments({
      createdAt: { $gte: currentMonthStart },
      'coupon.code': { $exists: true, $ne: null }
    });

    const couponOrdersLastMonth = await Order.countDocuments({
      createdAt: { $gte: lastMonthStart, $lt: currentMonthStart },
      'coupon.code': { $exists: true, $ne: null }
    });

    console.log(`✅ Coupons: Current=${couponOrdersThisMonth}, Previous=${couponOrdersLastMonth}`);

    // ==================== AGENCY PAYABLE ====================
    console.log('💵 Calculating agency payables...');
    let payableThisMonth = 0;
    let payableLastMonth = 0;

    try {
      const agencyPayThisMonth = await DeliveryAgency.aggregate([
        { $unwind: '$paymentRecords' },
        {
          $match: {
            $expr: {
              $gte: [
                { $toDate: '$paymentRecords.paymentDate' },
                currentMonthStart
              ]
            },
            'paymentRecords.status': { $in: ['Unpaid', 'Pending', 'Paid'] }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$paymentRecords.amount' }
          }
        }
      ]);

      const agencyPayLastMonth = await DeliveryAgency.aggregate([
        { $unwind: '$paymentRecords' },
        {
          $match: {
            $expr: {
              $and: [
                {
                  $gte: [
                    { $toDate: '$paymentRecords.paymentDate' },
                    lastMonthStart
                  ]
                },
                {
                  $lt: [
                    { $toDate: '$paymentRecords.paymentDate' },
                    currentMonthStart
                  ]
                }
              ]
            },
            'paymentRecords.status': { $in: ['Unpaid', 'Pending', 'Paid'] }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$paymentRecords.amount' }
          }
        }
      ]);

      payableThisMonth = agencyPayThisMonth[0]?.total || 0;
      payableLastMonth = agencyPayLastMonth[0]?.total || 0;
    } catch (error) {
      console.log('⚠️ Agency payable calculation failed:', error.message);
    }

    console.log(`✅ Agency Payable: Current=${payableThisMonth}, Previous=${payableLastMonth}`);

    // ==================== TOP PRODUCTS ====================
    console.log('🏆 Calculating top products...');
    let topSellingProductsTotalAmount = 0;
    let topSellingProductsLastAmount = 0;

    try {
      const topProductSalesCurrentMonthAgg = await Order.aggregate([
        {
          $match: {
            status: 'Delivered',
            createdAt: { $gte: currentMonthStart }
          }
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
                  { $ifNull: ['$totalPayable', 0] }
                ]
              }
            },
            count: { $sum: '$items.quantity' }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 1 }
      ]);

      if (topProductSalesCurrentMonthAgg.length > 0) {
        topSellingProductsTotalAmount =
          topProductSalesCurrentMonthAgg[0].totalAmount || 0;

        const topProductSalesLastMonthAgg = await Order.aggregate([
          {
            $match: {
              status: 'Delivered',
              createdAt: { $gte: lastMonthStart, $lt: currentMonthStart }
            }
          },
          { $unwind: '$items' },
          {
            $match: {
              'items.shopProductId': topProductSalesCurrentMonthAgg[0]._id
            }
          },
          {
            $group: {
              _id: '$items.shopProductId',
              totalAmount: {
                $sum: {
                  $cond: [
                    { $eq: [{ $type: '$totalPayable' }, 'string'] },
                    { $toDouble: '$totalPayable' },
                    { $ifNull: ['$totalPayable', 0] }
                  ]
                }
              }
            }
          }
        ]);

        topSellingProductsLastAmount =
          topProductSalesLastMonthAgg[0]?.totalAmount || 0;
      }
    } catch (error) {
      console.log('⚠️ Top products calculation failed:', error.message);
    }

    console.log(`✅ Top Products: Current=${topSellingProductsTotalAmount}, Previous=${topSellingProductsLastAmount}`);

    // ==================== VISITORS ====================
    console.log('👥 Calculating visitors...');
    const totalVisitors = await User.countDocuments({
      role: 'CUSTOMER',
      createdAt: { $gte: currentMonthStart }
    });

    const previousVisitors = await User.countDocuments({
      role: 'CUSTOMER',
      createdAt: { $gte: lastMonthStart, $lt: currentMonthStart }
    });

    console.log(`✅ Visitors: Current=${totalVisitors}, Previous=${previousVisitors}`);

    // ==================== RESPONSE ====================
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
      
      totalVisitors,
      visitorGrowth: getGrowth(totalVisitors, previousVisitors),
      visitorDateCompared: lastMonthLabel,
    };

    console.log('✅ Dashboard data prepared successfully');

    res.status(200).json({
      message: 'Super Admin Dashboard Analytics',
      success: true,
      data: responseData
    });
  } catch (err) {
    console.error('❌ Super Admin Dashboard Error:', err);
    res.status(500).json({
      message: 'Failed to fetch Super Admin Dashboard',
      success: false,
      error: err.message
    });
  }
};

// Add this new function to dashboardController.js
exports.getWeeklySales = async (req, res) => {
  try {
    console.log('📊 Fetching Weekly Sales Data');
    
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);

    // Get orders from last 7 days grouped by day
    const weeklySales = await Order.aggregate([
      {
        $match: {
          status: 'Delivered', // Only count delivered orders
          createdAt: { $gte: sevenDaysAgo }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          totalSales: {
            $sum: {
              $cond: [
                { $eq: [{ $type: '$totalPayable' }, 'string'] },
                { $toDouble: '$totalPayable' },
                { $ifNull: ['$totalPayable', 0] }
              ]
            }
          },
          orderCount: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Create array for last 7 days with zero values
    const salesByDay = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(now.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const existingData = weeklySales.find(s => s._id === dateStr);
      
      salesByDay.push({
        date: dateStr,
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        totalSales: existingData ? Math.round(existingData.totalSales) : 0,
        orderCount: existingData ? existingData.orderCount : 0
      });
    }

    console.log('✅ Weekly sales data:', salesByDay);

    res.status(200).json({
      message: 'Weekly sales fetched successfully',
      success: true,
      data: salesByDay
    });

  } catch (err) {
    console.error('❌ Weekly Sales Error:', err);
    res.status(500).json({
      message: 'Failed to fetch weekly sales',
      success: false,
      error: err.message
    });
  }
};

// Add this to dashboardController.js
exports.getOrderStatusDistribution = async (req, res) => {
  try {
    console.log('📊 Fetching Order Status Distribution');

    const orderStatuses = await Order.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    const formattedData = orderStatuses.map(item => ({
      status: item._id || 'Unknown',
      count: item.count,
      percentage: 0 // Will calculate on frontend
    }));

    const total = formattedData.reduce((sum, item) => sum + item.count, 0);
    formattedData.forEach(item => {
      item.percentage = total > 0 ? Math.round((item.count / total) * 100) : 0;
    });

    console.log('✅ Order status distribution:', formattedData);

    res.status(200).json({
      message: 'Order status distribution fetched successfully',
      success: true,
      data: formattedData
    });

  } catch (err) {
    console.error('❌ Order Status Distribution Error:', err);
    res.status(500).json({
      message: 'Failed to fetch order status distribution',
      success: false,
      error: err.message
    });
  }
};

// Export other functions as needed
exports.getShopDashboardByShopId = async (req, res) => {
  // Keep existing implementation
};