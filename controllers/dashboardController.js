const Order = require('../models/Order');
const  Product  = require('../models/Product');
const Stock = require('../models/Stock');
const User = require('../models/User');
const DeliveryBoy = require('../models/DeliveryBoy'); // If separate model
const { DeliveryAgency } = require('../models/DeliveryAgency');

exports.getShopDashboardByShopId = async (req, res) => {
  try {
    const shopId = req.params.shopId || req.query.shopId;
    if (!shopId) {
      return res.status(400).json({
        message: 'Shop ID is required',
        success: false
      });
    }

    const currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const lastMonthStart = new Date(currentMonthStart);
    lastMonthStart.setMonth(currentMonthStart.getMonth() - 1);

    const formatMonth = (date) =>
      date.toLocaleString('default', { month: 'long', year: 'numeric' });
    const lastMonthLabel = formatMonth(lastMonthStart);

    const getGrowthString = (current, previous) => {
      if (previous === 0 && current === 0) return `No change compared to ${lastMonthLabel}`;
      const change = previous === 0 ? 100 : ((current - previous) / previous) * 100;
      const arrow = change >= 0 ? '🔼' : '🔽';
      const sign = change >= 0 ? '+' : '';
      return `Compared to ${lastMonthLabel} ${arrow} ${sign}${Math.round(change)}%`;
    };

    // 🛒 Orders
    const totalOrders = await Order.countDocuments({
      shopId,
      createdAt: { $gte: currentMonthStart }
    });

    const previousOrders = await Order.countDocuments({
      shopId,
      createdAt: { $gte: lastMonthStart, $lt: currentMonthStart }
    });

    // 💰 Sales
    const currentSalesAgg = await Order.aggregate([
      { $match: { shopId, createdAt: { $gte: currentMonthStart } } },
      { $group: { _id: null, total: { $sum: { $toDouble: '$totalAmount' } } } }
    ]);
    const previousSalesAgg = await Order.aggregate([
      { $match: { shopId, createdAt: { $gte: lastMonthStart, $lt: currentMonthStart } } },
      { $group: { _id: null, total: { $sum: { $toDouble: '$totalAmount' } } } }
    ]);

    const currentSales = currentSalesAgg[0]?.total || 0;
    const previousSales = previousSalesAgg[0]?.total || 0;

    // 🔝 Top Products
    const topProductIds = await Order.aggregate([
      { $match: { shopId, createdAt: { $gte: currentMonthStart } } },
      { $unwind: '$productId' },
      { $group: { _id: '$productId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    const productIdToName = {};
    const parentProducts = await Product.find({ shopId });

    parentProducts.forEach(doc => {
      doc.products.forEach(p => {
        productIdToName[p._id.toString()] = p.name;
      });
    });

    const topProducts = topProductIds.map(p => ({
      productId: p._id,
      name: productIdToName[p._id.toString()] || 'Unknown',
      sold: p.count
    }));

    // Step 1: get all sub-product IDs from Stock
const rawStock = await Stock.find({
    shopId,
    $expr: { $lt: ['$quantity', '$threshold'] }
  });
  
  const subProductIds = rawStock.map(s => s.productId?.toString());
  
  // Step 2: Fetch parent Product docs that contain any of these embedded products
  const matchedProducts = await Product.find({ 'products._id': { $in: subProductIds } });
  
  const subProductIdToNameMap = {};
  matchedProducts.forEach(product => {
    product.products.forEach(sub => {
      subProductIdToNameMap[sub._id.toString()] = sub.name;
    });
  });
  
  // Step 3: Format stock
  const lowStockFormatted = rawStock.map(s => ({
    name: subProductIdToNameMap[s.productId?.toString()] || 'Unknown',
    quantity: s.quantity,
    threshold: s.threshold,
    lastUpdated: s.updatedAt
  }));

    // 👥 New Visitors
    const newUsers = await User.countDocuments({
      createdAt: { $gte: currentMonthStart },
      role: 'customer'
    });

    const previousUsers = await User.countDocuments({
      createdAt: { $gte: lastMonthStart, $lt: currentMonthStart },
      role: 'customer'
    });

    return res.status(200).json({
      message: 'Shop Dashboard Analytics',
      success: true,
      shopId,
      data: {
        totalOrders,
        orderGrowth: getGrowthString(totalOrders, previousOrders),
        totalSales: parseFloat(currentSales.toFixed(2)),
        salesGrowth: getGrowthString(currentSales, previousSales),
        salesDateCompared: lastMonthLabel,
        orderDateCompared: lastMonthLabel,
        topProducts,
        lowStock: lowStockFormatted,
        newVisitors: newUsers,
        visitorsGrowth: getGrowthString(newUsers, previousUsers)
      }
    });

  } catch (error) {
    return res.status(500).json({
      message: 'Failed to load dashboard',
      success: false,
      error: error.message
    });
  }
};



exports.getSuperAdminDashboard = async (req, res) => {
    try {
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(currentMonthStart);
      lastMonthStart.setMonth(currentMonthStart.getMonth() - 1);
  
      const formatMonth = (date) => date.toLocaleString('default', { month: 'long', year: 'numeric' });
      const lastMonthLabel = formatMonth(lastMonthStart);
  
      const getGrowth = (current, previous) => {
        if (previous === 0 && current === 0) return `No change`;
        const change = previous === 0 ? 100 : ((current - previous) / previous) * 100;
        return `${Math.round(Math.abs(change))}%`;
      };
  
      // 📦 Orders
      const totalOrders = await Order.countDocuments({ createdAt: { $gte: currentMonthStart } });
      const previousOrders = await Order.countDocuments({ createdAt: { $gte: lastMonthStart, $lt: currentMonthStart } });
  
      // 💰 Total Sales (this month and last)
      const thisSales = await Order.aggregate([
        { $match: { createdAt: { $gte: currentMonthStart } } },
        { $group: { _id: null, total: { $sum: { $toDouble: '$totalAmount' } } } }
      ]);
      const lastSales = await Order.aggregate([
        { $match: { createdAt: { $gte: lastMonthStart, $lt: currentMonthStart } } },
        { $group: { _id: null, total: { $sum: { $toDouble: '$totalAmount' } } } }
      ]);
      const totalSalesAmount = thisSales[0]?.total || 0;
      const previousSalesAmount = lastSales[0]?.total || 0;

      // 🎟️ Coupon Usage
      const couponOrdersThisMonth = await Order.aggregate([
        {
          $match: {
            createdAt: { $gte: currentMonthStart },
            'appliedCoupon.code': { $exists: true, $ne: null }
          }
        },
        {
          $group: {
            _id: '$masterOrderId'
          }
        },
        {
          $count: 'count'
        }
      ]);
      const couponOrdersLastMonth = await Order.aggregate([
        {
          $match: {
            createdAt: { $gte: lastMonthStart, $lt: currentMonthStart },
            'appliedCoupon.code': { $exists: true, $ne: null }
          }
        },
        {
          $group: {
            _id: '$masterOrderId'
          }
        },
        {
          $count: 'count'
        }
      ]);

      const couponTotalUsageCount = couponOrdersThisMonth[0]?.count || 0;
      const couponUsageLastMonth = couponOrdersLastMonth[0]?.count || 0;
  
      // 🧾 Payable to Agency (include Unpaid, Pending, Paid)
      const agencyPayThisMonth = await DeliveryAgency.aggregate([
        { $unwind: '$paymentRecords' },
        {
          $match: {
            $expr: { $gte: [{ $toDate: '$paymentRecords.paymentDate' }, currentMonthStart] },
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
                { $gte: [{ $toDate: '$paymentRecords.paymentDate' }, lastMonthStart] },
                { $lt: [{ $toDate: '$paymentRecords.paymentDate' }, currentMonthStart] }
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

      const payableThisMonth = agencyPayThisMonth[0]?.total || 0;
      const payableLastMonth = agencyPayLastMonth[0]?.total || 0;
  
      // 🔝 Top Products
      const topProductData = await Order.aggregate([
        { $unwind: '$productId' },
        { $group: { _id: '$productId', sold: { $sum: 1 } } },
        { $sort: { sold: -1 } },
        { $limit: 5 }
      ]);
      const productIds = topProductData.map(p => p._id);
      const productDocs = await Product.find({ 'products._id': { $in: productIds } });
      const topSellingProducts = topProductData.map(entry => {
        let name = 'Unknown';
        productDocs.forEach(prod => {
          const found = prod.products.find(p => p._id.toString() === entry._id.toString());
          if (found) name = found.name;
        });
        return { productId: entry._id, name, sold: entry.sold };
      });

      // 🧾 Top Product Sales Total Amount (filter by delivered and compare correctly)
      const topProductSalesCurrentMonthAgg = await Order.aggregate([
        {
          $match: {
            orderStatus: 'Delivered',
            createdAt: { $gte: currentMonthStart }
          }
        },
        { $unwind: '$productId' },
        {
          $group: {
            _id: '$productId.productId',
            totalAmount: { $sum: { $toDouble: '$totalAmount' } },
            count: { $sum: '$productId.quantity' }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 1 }
      ]);
      const topProductSalesLastMonthAgg = await Order.aggregate([
        {
          $match: {
            orderStatus: 'Delivered',
            createdAt: { $gte: lastMonthStart, $lt: currentMonthStart }
          }
        },
        { $unwind: '$productId' },
        {
          $group: {
            _id: '$productId.productId',
            totalAmount: { $sum: { $toDouble: '$totalAmount' } },
            count: { $sum: '$productId.quantity' }
          }
        },
        { $match: { _id: topProductSalesCurrentMonthAgg[0]?._id } }
      ]);

      const topSellingProductsTotalAmount = topProductSalesCurrentMonthAgg[0]?.totalAmount || 0;
      const topSellingProductsLastAmount = topProductSalesLastMonthAgg[0]?.totalAmount || 0;
  
      // 🚚 Delivery Boys
      const totalDeliveryBoys = await User.countDocuments({ role: 'deliveryBoy' });
      const previousDeliveryBoys = await User.countDocuments({
        role: 'deliveryBoy',
        createdAt: { $gte: lastMonthStart, $lt: currentMonthStart }
      });
  
      // 👤 Visitors (new users)
      const totalVisitors = await User.countDocuments({ role: 'customer', createdAt: { $gte: currentMonthStart } });
      const previousVisitors = await User.countDocuments({
        role: 'customer',
        createdAt: { $gte: lastMonthStart, $lt: currentMonthStart }
      });
  
      res.status(200).json({
        message: 'Super Admin Dashboard Analytics',
        success: true,
        data: {
          totalSalesAmount: totalSalesAmount.toFixed(0),
          salesGrowth: getGrowth(totalSalesAmount, previousSalesAmount),
          salesDateCompared: lastMonthLabel,
          orderDateCompared: lastMonthLabel,
          totalOrders,
          orderGrowth: getGrowth(totalOrders, previousOrders),
          orderDateCompared: lastMonthLabel,
          payableToAgencies: payableThisMonth.toFixed(0),
          payableToAgenciesGrowth: getGrowth(payableThisMonth, payableLastMonth),
          payableToAgenciesDateCompared: lastMonthLabel,
          topSellingProductsTotalAmount: topSellingProductsTotalAmount.toFixed(0),
          topSellingProductsGrowth: getGrowth(topSellingProductsTotalAmount, topSellingProductsLastAmount),
          topSellingProductsDateCompared: lastMonthLabel,
           couponTotalUsageCount,
          couponGrowth: getGrowth(couponTotalUsageCount, couponUsageLastMonth),
          couponDateCompared: lastMonthLabel,
          totalVisitors,
          visitorGrowth: getGrowth(totalVisitors, previousVisitors),
          visitorDateCompared: lastMonthLabel,
        }
      });
    } catch (err) {
      res.status(500).json({
        message: 'Failed to fetch Super Admin Dashboard',
        success: false,
        error: err.message
      });
    }
  };