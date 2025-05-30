const Order = require('../models/Order');
const  Product  = require('../models/Product');
const Stock = require('../models/Stock');
const User = require('../models/User');
const DeliveryBoy = require('../models/DeliveryBoy'); // If separate model
const Agency = require('../models/DeliveryAgency'); // Optional

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
      const change = previous === 0 ? 100 : Math.round(((current - previous) / previous) * 100);
      const arrow = change >= 0 ? '🔼' : '🔽';
      const sign = change >= 0 ? '+' : '';
      return `Compared to ${lastMonthLabel} ${arrow} ${sign}${change}%`;
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
        const arrow = change >= 0 ? '🔼' : '🔽';
        return `${arrow} ${Math.abs(change).toFixed(2)}%`;
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
  
      // 🧾 Payable to Agency (successful deliveries)
      const agencyPayThisMonth = await Order.aggregate([
        {
          $match: {
            createdAt: { $gte: currentMonthStart },
            orderStatus: 'Delivered',
            assignedDeliveryBoy: { $ne: null }
          }
        },
        {
          $lookup: {
            from: 'deliveryboys',
            localField: 'assignedDeliveryBoy',
            foreignField: '_id',
            as: 'deliveryBoy'
          }
        },
        { $unwind: '$deliveryBoy' },
        {
          $lookup: {
            from: 'agencies',
            localField: 'deliveryBoy.agencyId',
            foreignField: '_id',
            as: 'agency'
          }
        },
        {
          $group: {
            _id: '$deliveryBoy.agencyId',
            agencyName: { $first: '$agency.agencyDetails.agencyName' },
            totalOrders: { $sum: 1 },
            totalAmount: { $sum: { $toDouble: '$totalAmount' } }
          }
        }
      ]);
  
      const totalPayable = agencyPayThisMonth.reduce((acc, a) => acc + a.totalAmount, 0);
  
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
          totalOrders,
          orderGrowth: getGrowth(totalOrders, previousOrders),
          totalSalesAmount: totalSalesAmount.toFixed(2),
          salesGrowth: getGrowth(totalSalesAmount, previousSalesAmount),
          payableToAgencies: totalPayable.toFixed(2),
          topSellingProducts,
          totalDeliveryBoys,
          deliveryBoyGrowth: getGrowth(totalDeliveryBoys, previousDeliveryBoys),
          totalVisitors,
          visitorGrowth: getGrowth(totalVisitors, previousVisitors)
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