const Order = require('../models/Order');
const Payment = require('../models/Payment');
const ShopProduct = require('../models/ShopProduct');
const Stock = require('../models/Stock');
const User = require('../models/User');
const Coupon = require('../models/Coupon');
const moment = require('moment');
const { Shop } = require('../models/Shop');
const AgencyPayout = require('../models/AgencyPayout');
const mongoose = require('mongoose'); 

// ==================== SHOP WISE SALES ====================
exports.getShopWiseSales = async (req, res) => {
  try {
    const result = await Order.aggregate([
      { $match: { status: 'Delivered' } },
      { 
        $group: { 
          _id: "$shopId", 
          totalOrders: { $sum: 1 },
          totalSales: { $sum: "$totalPayable" }
        } 
      },
      { 
        $lookup: { 
          from: "shops", 
          localField: "_id", 
          foreignField: "_id", 
          as: "shopInfo" 
        } 
      },
      { $unwind: { path: "$shopInfo", preserveNullAndEmptyArrays: true } },
      { 
        $project: { 
          shopId: "$_id",
          shopName: "$shopInfo.shopeDetails.shopName",
          shopEmail: "$shopInfo.shopeDetails.shopMail",
          shopContact: "$shopInfo.shopeDetails.shopContact",
          totalOrders: 1,
          totalSales: { $round: ["$totalSales", 2] }
        } 
      },
      { $sort: { totalSales: -1 } }
    ]);

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('Shop Wise Sales Error:', error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch shop wise sales", 
      error: error.message 
    });
  }
};

// ==================== CANCELLED ORDERS ====================
exports.getCancelledOrders = async (req, res) => {
  try {
    const cancelledOrders = await Order.find({ status: 'Cancelled' })
      .populate('userId', 'name email phone')
      .populate('shopId', 'shopeDetails.shopName')
      .populate({
        path: 'items.shopProductId',
        populate: {
          path: 'part',
          select: 'partName partNumber'
        }
      })
      .lean();

    const formatted = cancelledOrders.flatMap(order => {
      return order.items.map(item => ({
        _id: order._id,
        orderId: order._id,
        orderDate: order.createdAt,
        
        // Customer Info
        customerName: order.deliveryAddress?.name || order.userId?.name || '-',
        customerContact: order.deliveryAddress?.contact || order.userId?.phone || '-',
        customerAddress: order.deliveryAddress?.address || '-',
        customerArea: order.deliveryAddress?.area || '-',
        customerPlace: order.deliveryAddress?.place || '-',
        
        // Shop Info
        shopName: order.shopId?.shopeDetails?.shopName || 'Unknown Shop',
        
        // Product Info (from snapshot or populated data)
        partName: item.snapshot?.partName || item.shopProductId?.part?.partName || 'Product',
        partNumber: item.snapshot?.partNumber || item.shopProductId?.part?.partNumber || '-',
        quantity: item.quantity,
        itemPrice: item.snapshot?.price || 0,
        
        // Order Amounts
        orderSubtotal: order.subtotal,
        orderDiscount: order.discount,
        orderTotal: order.totalPayable,
        
        // Status
        status: order.status,
       cancelReason: order.cancellation?.reason || '-',
      }));
    });

    res.status(200).json({ success: true, data: formatted });
  } catch (error) {
    console.error('Cancelled Orders Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch cancelled orders', 
      error: error.message 
    });
  }
};

// ==================== RETURNED ORDERS ====================
exports.getReturnedOrders = async (req, res) => {
  try {
    const returnedOrders = await Order.find({ status: 'Returned' })
      .populate('userId', 'name email phone')
      .populate('shopId', 'shopeDetails.shopName')
      .populate({
        path: 'items.shopProductId',
        populate: {
          path: 'part',
          select: 'partName partNumber'
        }
      })
      .lean();

    const formatted = returnedOrders.flatMap(order => {
      return order.items.map(item => ({
        _id: order._id,
        orderId: order._id,
        orderDate: order.createdAt,
        
        // Customer Info
        customerName: order.deliveryAddress?.name || order.userId?.name || '-',
        customerContact: order.deliveryAddress?.contact || order.userId?.phone || '-',
        customerAddress: order.deliveryAddress?.address || '-',
        
        // Shop Info
        shopName: order.shopId?.shopeDetails?.shopName || 'Unknown Shop',
        
        // Product Info
        partName: item.snapshot?.partName || item.shopProductId?.part?.partName || 'Product',
        partNumber: item.snapshot?.partNumber || item.shopProductId?.part?.partNumber || '-',
        quantity: item.quantity,
        itemPrice: item.snapshot?.price || 0,
        
        // Order Amounts
        orderTotal: order.totalPayable,
        
        // Status
        status: order.status,
        returnReason: order.returnReason || '-'
      }));
    });

    res.status(200).json({ success: true, data: formatted });
  } catch (error) {
    console.error('Returned Orders Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch returned orders', 
      error: error.message 
    });
  }
};

// ==================== DAILY SALES ====================
exports.getDailySales = async (req, res) => {
  try {
    // ✅ FIX 1: Use explicit UTC offset for UAE (UTC+4)
    // ✅ FIX 2: Accept optional date param so frontend can pass specific date
    const { date } = req.query;

    let start, end;
    if (date) {
      // If specific date passed: e.g. ?date=2026-02-28
      start = moment.utc(date).startOf('day').subtract(-4, 'hours').toDate(); 
      // Simpler: just use UTC midnight boundaries and widen by 1 day
      start = new Date(`${date}T00:00:00.000+04:00`);
      end   = new Date(`${date}T23:59:59.999+04:00`);
    } else {
      // Today in UAE time (UTC+4)
      const nowUAE = moment().utcOffset('+04:00');
      const todayStr = nowUAE.format('YYYY-MM-DD');
      start = new Date(`${todayStr}T00:00:00.000+04:00`);
      end   = new Date(`${todayStr}T23:59:59.999+04:00`);
    }

    // ✅ FIX 3: Filter by updatedAt (when status changed to Delivered)
    //           NOT createdAt (when order was placed)
    const orders = await Order.find({
      status: 'Delivered',
      updatedAt: { $gte: start, $lte: end }   // was: createdAt
    })
    .populate('shopId', 'shopeDetails.shopName')
    .lean();

    const total = orders.reduce((sum, order) => sum + (order.totalPayable || 0), 0);

   const formatted = orders.flatMap(order =>
  (order.items || []).map(item => ({
    orderId: order._id,
    orderDate: order.createdAt,
    deliveredAt: order.updatedAt,
    shopName: order.shopId?.shopeDetails?.shopName || 'Unknown',
    customerName: order.deliveryAddress?.name || '-',
    paymentMethod: order.paymentType,
    partName: item.snapshot?.partName || '-',
    partNumber: item.snapshot?.partNumber || '-',
    quantity: item.quantity || 1,
    unitPrice: item.snapshot?.discountedPrice ?? item.snapshot?.price ?? 0,
    lineTotal: (item.quantity || 1) * (item.snapshot?.discountedPrice ?? item.snapshot?.price ?? 0),
    orderTotal: Math.round((order.totalPayable || 0) * 100) / 100,
  }))
);

    res.status(200).json({ 
      success: true, 
      totalSales: Math.round(total * 100) / 100,
      count: orders.length,
      dateRange: { from: start, to: end },   // ✅ Add this for debugging
      data: formatted 
    });
  } catch (err) {
    console.error('Daily Sales Error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch daily sales', 
      error: err.message 
    });
  }
};

// ==================== WEEKLY SALES ====================
exports.getWeeklySales = async (req, res) => {
  try {
    const start = moment().startOf('week').toDate();
    const end = moment().endOf('week').toDate();

    const orders = await Order.find({
      status: 'Delivered',
      createdAt: { $gte: start, $lte: end }
    })
    .populate('shopId', 'shopeDetails.shopName')
    .lean();

    const total = orders.reduce((sum, order) => sum + (order.totalPayable || 0), 0);

    const formatted = orders.flatMap(order =>
  (order.items || []).map(item => ({
    orderId: order._id,
    orderDate: order.createdAt,
    shopName: order.shopId?.shopeDetails?.shopName || 'Unknown',
    customerName: order.deliveryAddress?.name || '-',
    paymentMethod: order.paymentType,
    partName: item.snapshot?.partName || '-',
    partNumber: item.snapshot?.partNumber || '-',
    quantity: item.quantity || 1,
    unitPrice: item.snapshot?.discountedPrice ?? item.snapshot?.price ?? 0,
    lineTotal: (item.quantity || 1) * (item.snapshot?.discountedPrice ?? item.snapshot?.price ?? 0),
    orderTotal: Math.round((order.totalPayable || 0) * 100) / 100,
  }))
);

    res.status(200).json({ 
      success: true, 
      totalSales: Math.round(total * 100) / 100,
      count: orders.length,
      data: formatted 
    });
  } catch (err) {
    console.error('Weekly Sales Error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch weekly sales', 
      error: err.message 
    });
  }
};

// ==================== MONTHLY SALES ====================
exports.getMonthlySales = async (req, res) => {
  try {
    const { date } = req.query; // optional: ?date=2026-02-01 to query a specific month

    let start, end;
    if (date) {
      const refDate = moment(date).utcOffset('+04:00');
      start = new Date(refDate.clone().startOf('month').format('YYYY-MM-DDTHH:mm:ss') + '+04:00');
      end   = new Date(refDate.clone().endOf('month').format('YYYY-MM-DDTHH:mm:ss') + '+04:00');
    } else {
      const nowUAE = moment().utcOffset('+04:00');
      start = new Date(nowUAE.clone().startOf('month').format('YYYY-MM-DDTHH:mm:ss') + '+04:00');
      end   = new Date(nowUAE.clone().endOf('month').format('YYYY-MM-DDTHH:mm:ss') + '+04:00');
    }

    const orders = await Order.find({
      status: 'Delivered',
      updatedAt: { $gte: start, $lte: end }  // ✅ updatedAt = when delivered
    })
    .populate('shopId', 'shopeDetails.shopName')
    .lean();

    const total = orders.reduce((sum, order) => sum + (order.totalPayable || 0), 0);
    const totalOrders = orders.length;

    // ✅ Weekly breakdown within the month
    const weeklyBreakdown = {};
    orders.forEach(order => {
      const deliveredUAE = moment(order.updatedAt).utcOffset('+04:00');
      const weekKey = deliveredUAE.week();
      const weekStart = deliveredUAE.clone().startOf('week').format('YYYY-MM-DD');
      const weekEnd   = deliveredUAE.clone().endOf('week').format('YYYY-MM-DD');

      if (!weeklyBreakdown[weekKey]) {
        weeklyBreakdown[weekKey] = {
          week: weekKey,
          weekStart,
          weekEnd,
          sales: 0,
          orders: 0
        };
      }
      weeklyBreakdown[weekKey].sales  += order.totalPayable || 0;
      weeklyBreakdown[weekKey].orders += 1;
    });

    // ✅ Daily breakdown within the month
    const dailyBreakdown = {};
    orders.forEach(order => {
      const day = moment(order.updatedAt).utcOffset('+04:00').format('YYYY-MM-DD');
      if (!dailyBreakdown[day]) {
        dailyBreakdown[day] = { date: day, sales: 0, orders: 0 };
      }
      dailyBreakdown[day].sales  += order.totalPayable || 0;
      dailyBreakdown[day].orders += 1;
    });

   const formatted = orders.flatMap(order =>
  (order.items || []).map(item => ({
    orderId: order._id,
    orderDate: order.createdAt,
    deliveredAt: order.updatedAt,
    orderDate_UAE: moment(order.createdAt).utcOffset('+04:00').format('YYYY-MM-DD'),
    deliveredDate_UAE: moment(order.updatedAt).utcOffset('+04:00').format('YYYY-MM-DD'),
    shopName: order.shopId?.shopeDetails?.shopName || 'Unknown',
    customerName: order.deliveryAddress?.name || '-',
    paymentMethod: order.paymentType,
    partName: item.snapshot?.partName || '-',
    partNumber: item.snapshot?.partNumber || '-',
    quantity: item.quantity || 1,
    unitPrice: item.snapshot?.discountedPrice ?? item.snapshot?.price ?? 0,
    lineTotal: (item.quantity || 1) * (item.snapshot?.discountedPrice ?? item.snapshot?.price ?? 0),
    orderTotal: Math.round((order.totalPayable || 0) * 100) / 100,
  }))
);

    res.status(200).json({
      success: true,
      totalSales: Math.round(total * 100) / 100,
      count: totalOrders,
      averageOrderValue: totalOrders > 0
        ? Math.round((total / totalOrders) * 100) / 100
        : 0,
      dateRange: { from: start, to: end },
      weeklyBreakdown: Object.values(weeklyBreakdown)
        .map(w => ({ ...w, sales: Math.round(w.sales * 100) / 100 }))
        .sort((a, b) => a.week - b.week),
      dailyBreakdown: Object.values(dailyBreakdown)
        .map(d => ({ ...d, sales: Math.round(d.sales * 100) / 100 }))
        .sort((a, b) => new Date(a.date) - new Date(b.date)),
      data: formatted
    });
  } catch (err) {
    console.error('Monthly Sales Error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch monthly sales',
      error: err.message
    });
  }
};

// ==================== TOP SELLING PRODUCTS ====================
exports.getTopSellingProducts = async (req, res) => {
  try {
    // ✅ Support optional date filtering from dashboard card click
    const { from, to } = req.query;
    const matchStage = { status: 'Delivered' };
    
    if (from || to) {
      matchStage.createdAt = {};
      if (from) matchStage.createdAt.$gte = new Date(from);
      if (to)   matchStage.createdAt.$lte = new Date(to);
    }

    const topProducts = await Order.aggregate([
      { $match: matchStage },  // ✅ was hardcoded, now uses filter
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.shopProductId',
          totalSold: { $sum: '$items.quantity' },
          totalRevenue: { 
            $sum: { 
              $multiply: ['$items.quantity', '$items.snapshot.price'] 
            } 
          },
          partName: { $first: '$items.snapshot.partName' },
          partNumber: { $first: '$items.snapshot.partNumber' }
        }
      },
      { $sort: { totalSold: -1 } },
      // ... rest of lookups unchanged
    ]);

    res.status(200).json({ success: true, data: topProducts });
  } catch (error) {
    logger.error('Top Selling Products Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch top selling products', 
      error: error.message 
    });
  }
};

// ==================== LOW SELLING PRODUCTS ====================
exports.getLowSellingProducts = async (req, res) => {
  try {
    const lowProducts = await Order.aggregate([
      { $match: { status: 'Delivered' } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.shopProductId',
          totalSold: { $sum: '$items.quantity' },
          totalRevenue: { 
            $sum: { 
              $multiply: ['$items.quantity', '$items.snapshot.price'] 
            } 
          },
          partName: { $first: '$items.snapshot.partName' },
          partNumber: { $first: '$items.snapshot.partNumber' }
        }
      },
      { $sort: { totalSold: 1 } }, 
      {
        $lookup: {
          from: 'shopproducts',
          localField: '_id',
          foreignField: '_id',
          as: 'productInfo'
        }
      },
      { $unwind: { path: '$productInfo', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'partscatalogs',
          localField: 'productInfo.part',
          foreignField: '_id',
          as: 'partInfo'
        }
      },
      { $unwind: { path: '$partInfo', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          shopProductId: '$_id',
          partName: { 
            $ifNull: ['$partName', '$partInfo.partName', 'Product'] 
          },
          partNumber: { 
            $ifNull: ['$partNumber', '$partInfo.partNumber', '-'] 
          },
          totalSold: 1,
          totalRevenue: { $round: ['$totalRevenue', 2] },
          currentStock: '$productInfo.stock'
        }
      },
     
      { $limit: 20 }
    ]);

    res.status(200).json({ success: true, data: lowProducts });
  } catch (error) {
    console.error('Low Selling Products Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch low selling products', 
      error: error.message 
    });
  }
};

// ==================== LOW STOCK PARTS ====================
exports.getLowStockParts = async (req, res) => {
  try {
    const lowStockProducts = await ShopProduct.find({ 
      stock: { $lt: 20, $gt: 0 } 
    })
    .populate('part', 'partName partNumber images')
    .populate('shopId', 'shopeDetails.shopName')
    .lean();

    const formatted = lowStockProducts.map(product => ({
      _id: product._id,
      shopProductId: product._id,
      partName: product.part?.partName || 'Unknown',
      partNumber: product.part?.partNumber || '-',
      currentStock: product.stock,
      price: product.price,
      discountedPrice: product.discountedPrice,
      shopName: product.shopId?.shopeDetails?.shopName || 'Unknown Shop',
      image: product.part?.images?.[0] || null
    }));

    res.status(200).json({ success: true, data: formatted });
  } catch (error) {
    console.error('Low Stock Parts Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch low stock parts', 
      error: error.message 
    });
  }
};

// ==================== OUT OF STOCK PARTS ====================
exports.getOutOfStockParts = async (req, res) => {
  try {
    const outOfStockProducts = await ShopProduct.find({ stock: 0 })
    .populate('part', 'partName partNumber images')
    .populate('shopId', 'shopeDetails.shopName')
    .lean();

    const formatted = outOfStockProducts.map(product => ({
      _id: product._id,
      shopProductId: product._id,
      partName: product.part?.partName || 'Unknown',
      partNumber: product.part?.partNumber || '-',
      currentStock: 0,
      price: product.price,
      discountedPrice: product.discountedPrice,
      shopName: product.shopId?.shopeDetails?.shopName || 'Unknown Shop',
      image: product.part?.images?.[0] || null
    }));

    res.status(200).json({ success: true, data: formatted });
  } catch (error) {
    console.error('Out of Stock Parts Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch out of stock parts', 
      error: error.message 
    });
  }
};

// ==================== TOP BUYERS ====================
exports.getTopBuyers = async (req, res) => {
  try {
    const topBuyers = await Order.aggregate([
      { $match: { status: 'Delivered' } },
      {
        $group: {
          _id: '$userId',
          totalSpent: { $sum: '$totalPayable' },
          orderCount: { $sum: 1 },
          lastOrderDate: { $max: '$createdAt' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      { $unwind: { path: '$userInfo', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          userId: '$_id',
          customerName: { $ifNull: ['$userInfo.name', 'Unknown'] },
          email: { $ifNull: ['$userInfo.email', '-'] },
          phone: { $ifNull: ['$userInfo.phone', '-'] },
          totalSpent: { $round: ['$totalSpent', 2] },
          orderCount: 1,
          lastOrderDate: 1,
          averageOrderValue: { 
            $round: [{ $divide: ['$totalSpent', '$orderCount'] }, 2] 
          }
        }
      },
      { $sort: { totalSpent: -1 } },
      { $limit: 20 }
    ]);

    res.status(200).json({ success: true, data: topBuyers });
  } catch (error) {
    console.error('Top Buyers Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch top buyers', 
      error: error.message 
    });
  }
};

// ==================== MOST USED COUPONS ====================
exports.getMostUsedCoupons = async (req, res) => {
  try {
    const mostUsedCoupons = await Order.aggregate([
      { $match: { 'coupon.code': { $exists: true, $ne: null } } },
      {
        $group: {
          _id: '$coupon.code',
          usageCount: { $sum: 1 },
          totalDiscount: { $sum: '$discount' },
          avgDiscount: { $avg: '$discount' }
        }
      },
      {
        $lookup: {
          from: 'coupons',
          localField: '_id',
          foreignField: 'code',
          as: 'couponInfo'
        }
      },
      { $unwind: { path: '$couponInfo', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          code: '$_id',
          usageCount: 1,
          totalDiscount: { $round: ['$totalDiscount', 2] },
          avgDiscount: { $round: ['$avgDiscount', 2] },
          discountType: '$couponInfo.discountType',
          discountValue: '$couponInfo.discountValue',
          minOrderAmount: '$couponInfo.minOrderAmount',
          expiryDate: '$couponInfo.expiryDate',
          isActive: '$couponInfo.isActive'
        }
      },
      { $sort: { usageCount: -1 } },
      { $limit: 20 }
    ]);

    res.status(200).json({ success: true, data: mostUsedCoupons });
  } catch (error) {
    console.error('Most Used Coupons Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch most used coupons', 
      error: error.message 
    });
  }
};

// ==================== SHOP-SPECIFIC REPORTS ====================

// Shop Sales by ID
exports.getShopSalesById = async (req, res) => {
  try {
    const { shopId } = req.query;

    const result = await Order.aggregate([
      { $match: { status: 'Delivered', shopId: shopId } },
      {
        $group: {
          _id: '$shopId',
          totalOrders: { $sum: 1 },
          totalSales: { $sum: '$totalPayable' },
          totalDiscount: { $sum: '$discount' }
        }
      }
    ]);

    res.status(200).json({ 
      success: true, 
      data: result[0] || { totalOrders: 0, totalSales: 0, totalDiscount: 0 } 
    });
  } catch (error) {
    console.error('Shop Sales Error:', error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch shop sales", 
      error: error.message 
    });
  }
};

// Shop Cancelled Orders
exports.getShopCancelledOrders = async (req, res) => {
  try {
    const { shopId } = req.query;

    const cancelledOrders = await Order.find({ 
      status: 'Cancelled', 
      shopId 
    })
    .populate('userId', 'name email phone')
    .lean();

    const formatted = cancelledOrders.flatMap(order => {
      return order.items.map(item => ({
        orderId: order._id,
        orderDate: order.createdAt,
        customerName: order.deliveryAddress?.name || order.userId?.name || '-',
        customerContact: order.deliveryAddress?.contact || '-',
        partName: item.snapshot?.partName || 'Product',
        partNumber: item.snapshot?.partNumber || '-',
        quantity: item.quantity,
        orderTotal: order.totalPayable,
        cancelReason: order.cancellation?.reason || '-'
      }));
    });

    res.status(200).json({ success: true, data: formatted });
  } catch (error) {
    console.error('Shop Cancelled Orders Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch cancelled orders', 
      error: error.message 
    });
  }
};

// Shop Returned Orders
exports.getShopReturnedOrders = async (req, res) => {
  try {
    const { shopId } = req.query;

    const returnedOrders = await Order.find({ 
      status: 'Returned', 
      shopId 
    })
    .populate('userId', 'name email phone')
    .lean();

    const formatted = returnedOrders.flatMap(order => {
      return order.items.map(item => ({
        orderId: order._id,
        orderDate: order.createdAt,
        customerName: order.deliveryAddress?.name || order.userId?.name || '-',
        customerContact: order.deliveryAddress?.contact || '-',
        partName: item.snapshot?.partName || 'Product',
        partNumber: item.snapshot?.partNumber || '-',
        quantity: item.quantity,
        orderTotal: order.totalPayable,
        returnReason: order.returnReason || '-'
      }));
    });

    res.status(200).json({ success: true, data: formatted });
  } catch (error) {
    console.error('Shop Returned Orders Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch returned orders', 
      error: error.message 
    });
  }
};

// Shop Pending Orders
exports.getShopPendingOrders = async (req, res) => {
  try {
    const { shopId } = req.query;

    const pendingOrders = await Order.find({ 
      status: 'Pending', 
      shopId 
    })
    .populate('userId', 'name email phone')
    .lean();

    const formatted = pendingOrders.map(order => ({
      orderId: order._id,
      orderDate: order.createdAt,
      customerName: order.deliveryAddress?.name || order.userId?.name || '-',
      customerContact: order.deliveryAddress?.contact || '-',
      itemCount: order.items?.length || 0,
      totalAmount: order.totalPayable,
      paymentMethod: order.paymentType,
      deliveryAddress: order.deliveryAddress?.address || '-'
    }));

    res.status(200).json({ success: true, data: formatted });
  } catch (error) {
    console.error('Shop Pending Orders Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch pending orders', 
      error: error.message 
    });
  }
};



// Shop Top/Low Selling Products
exports.getShopTopSellingProducts = async (req, res) => {
  try {
    const { shopId } = req.query;

    const topProducts = await Order.aggregate([
      { $match: { status: 'Delivered', shopId } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.shopProductId',
          totalSold: { $sum: '$items.quantity' },
          totalRevenue: { 
            $sum: { $multiply: ['$items.quantity', '$items.snapshot.price'] } 
          },
          partName: { $first: '$items.snapshot.partName' },
          partNumber: { $first: '$items.snapshot.partNumber' }
        }
      },
      {
        $project: {
          partName: { $ifNull: ['$partName', 'Product'] },
          partNumber: { $ifNull: ['$partNumber', '-'] },
          totalSold: 1,
          totalRevenue: { $round: ['$totalRevenue', 2] }
        }
      },
      { $sort: { totalSold: -1 } },
      { $limit: 20 }
    ]);

    res.status(200).json({ success: true, data: topProducts });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch top selling products for shop', 
      error: error.message 
    });
  }
};

exports.getShopLowSellingProducts = async (req, res) => {
  try {
    const { shopId } = req.query;

    const lowProducts = await Order.aggregate([
      { $match: { status: 'Delivered', shopId } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.shopProductId',
          totalSold: { $sum: '$items.quantity' },
          partName: { $first: '$items.snapshot.partName' },
          partNumber: { $first: '$items.snapshot.partNumber' }
        }
      },
      {
        $project: {
          partName: { $ifNull: ['$partName', 'Product'] },
          partNumber: { $ifNull: ['$partNumber', '-'] },
          totalSold: 1
        }
      },
      { $sort: { totalSold: 1 } },
      { $limit: 20 }
    ]);

    res.status(200).json({ success: true, data: lowProducts });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch low selling products for shop', 
      error: error.message 
    });
  }
};

// Shop Low/Out of Stock
exports.getShopLowStockParts = async (req, res) => {
  try {
    const { shopId } = req.query;

    const lowStockProducts = await ShopProduct.find({ 
      shopId,
      stock: { $lt: 20, $gt: 0 } 
    })
    .populate('part', 'partName partNumber images')
    .lean();

    const formatted = lowStockProducts.map(product => ({
      _id: product._id,
      partName: product.part?.partName || 'Unknown',
      partNumber: product.part?.partNumber || '-',
      currentStock: product.stock,
      price: product.price
    }));

    res.status(200).json({ success: true, data: formatted });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch low stock parts for shop', 
      error: error.message 
    });
  }
};

exports.getShopOutOfStockParts = async (req, res) => {
  try {
    const { shopId } = req.query;

    const outOfStockProducts = await ShopProduct.find({ 
      shopId,
      stock: 0 
    })
    .populate('part', 'partName partNumber images')
    .lean();

    const formatted = outOfStockProducts.map(product => ({
      _id: product._id,
      partName: product.part?.partName || 'Unknown',
      partNumber: product.part?.partNumber || '-',
      currentStock: 0,
      price: product.price
    }));

    res.status(200).json({ success: true, data: formatted });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch out of stock parts for shop', 
      error: error.message 
    });
  }
};

/**
 * Shop Pending Orders Report
 * GET /api/report/orders/pending/by-shop?shopId=xxx
 */
exports.getShopPendingOrders = async (req, res) => {
  try {
    const { shopId } = req.query;

    if (!shopId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Shop ID is required' 
      });
    }

    const orders = await Order.find({
      shopId,
      status: 'Pending'
    })
      .populate('userId', 'name email phone')
      .populate('shopId', 'shopName')
      .sort({ createdAt: -1 })
      .lean();

    const formatted = orders.map(order => ({
      orderId: order._id,
      orderNumber: order.orderNumber || `ORD-${order._id.toString().slice(-6)}`,
      customerName: order.deliveryAddress?.name || order.userId?.name || '-',
      customerContact: order.deliveryAddress?.contact || order.userId?.phone || '-',
      itemCount: order.items?.length || 0,
      totalAmount: Math.round((order.totalPayable || 0) * 100) / 100,
      paymentMethod: order.paymentType || 'COD',
      paymentStatus: order.paymentStatus || 'Pending',
      deliveryAddress: order.deliveryAddress?.address || '-',
      orderDate: order.createdAt,
      status: order.status
    }));

    res.status(200).json({ 
      success: true, 
      count: formatted.length,
      data: formatted 
    });
  } catch (error) {
    console.error('Shop Pending Orders Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch pending orders', 
      error: error.message 
    });
  }
};



/**
 * Shop Returned Orders Report
 * GET /api/report/orders/returned/by-shop?shopId=xxx
 */
exports.getShopReturnedOrders = async (req, res) => {
  try {
    const { shopId } = req.query;

    if (!shopId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Shop ID is required' 
      });
    }

    const orders = await Order.find({
      shopId,
      status: 'Returned'
    })
      .populate('userId', 'name email phone')
      .populate('shopId', 'shopName')
      .sort({ updatedAt: -1 })
      .lean();

    const formatted = orders.map(order => ({
      orderId: order._id,
      orderNumber: order.orderNumber || `ORD-${order._id.toString().slice(-6)}`,
      customerName: order.deliveryAddress?.name || order.userId?.name || '-',
      customerContact: order.deliveryAddress?.contact || order.userId?.phone || '-',
      itemCount: order.items?.length || 0,
      totalAmount: Math.round((order.totalPayable || 0) * 100) / 100,
      returnReason: order.returnReason || '-',
      returnedAt: order.updatedAt,
      orderDate: order.createdAt,
      refundStatus: order.refundStatus || 'Pending'
    }));

    res.status(200).json({ 
      success: true, 
      count: formatted.length,
      totalReturnedValue: formatted.reduce((sum, o) => sum + o.totalAmount, 0),
      data: formatted 
    });
  } catch (error) {
    console.error('Shop Returned Orders Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch returned orders', 
      error: error.message 
    });
  }
};

// ========================================
// SHOP SALES REPORTS
// ========================================

// ==================== SHOP DAILY SALES ====================
exports.getShopDailySales = async (req, res) => {
  try {
    const { shopId } = req.query;

    if (!shopId) {
      return res.status(400).json({ success: false, message: 'Shop ID is required' });
    }

    const nowUAE = moment().utcOffset('+04:00');
    const todayStr = nowUAE.format('YYYY-MM-DD');
    const start = new Date(`${todayStr}T00:00:00.000+04:00`);  // ✅ UAE timezone
    const end   = new Date(`${todayStr}T23:59:59.999+04:00`);

    const orders = await Order.find({
      shopId,
      status: 'Delivered',
      updatedAt: { $gte: start, $lte: end }  // ✅ updatedAt
    })
      .populate('userId', 'name email phone')
      .sort({ updatedAt: -1 })
      .lean();

    const totalSales = orders.reduce((sum, order) => sum + (order.totalPayable || 0), 0);
    const totalOrders = orders.length;

  const formatted = orders.flatMap(order =>
  (order.items || []).map(item => ({
    orderId: order._id,
    orderNumber: order.orderNumber || `ORD-${order._id.toString().slice(-6)}`,
    customerName: order.deliveryAddress?.name || order.userId?.name || '-',
    paymentMethod: order.paymentType || 'COD',
    orderTime: order.createdAt,
    deliveredTime: order.updatedAt,
    partName: item.snapshot?.partName || '-',
    partNumber: item.snapshot?.partNumber || '-',
    quantity: item.quantity || 1,
    unitPrice: item.snapshot?.discountedPrice ?? item.snapshot?.price ?? 0,
    lineTotal: (item.quantity || 1) * (item.snapshot?.discountedPrice ?? item.snapshot?.price ?? 0),
    orderTotal: Math.round((order.totalPayable || 0) * 100) / 100,
  }))
);

    res.status(200).json({
      success: true,
      period: 'Today',
      date: todayStr,
      totalSales: Math.round(totalSales * 100) / 100,
      totalOrders,
      averageOrderValue: totalOrders > 0 ? Math.round((totalSales / totalOrders) * 100) / 100 : 0,
      dateRange: { from: start, to: end },
      data: formatted
    });
  } catch (error) {
    console.error('Shop Daily Sales Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch daily sales', error: error.message });
  }
};

// ==================== SHOP WEEKLY SALES ====================
exports.getShopWeeklySales = async (req, res) => {
  try {
    const { shopId } = req.query;

    if (!shopId) {
      return res.status(400).json({ success: false, message: 'Shop ID is required' });
    }

    const nowUAE = moment().utcOffset('+04:00');
    const start = new Date(nowUAE.clone().startOf('week').format('YYYY-MM-DDTHH:mm:ss') + '+04:00');  // ✅
    const end   = new Date(nowUAE.clone().endOf('week').format('YYYY-MM-DDTHH:mm:ss') + '+04:00');

    const orders = await Order.find({
      shopId,
      status: 'Delivered',
      updatedAt: { $gte: start, $lte: end }  // ✅ updatedAt
    })
      .populate('userId', 'name email phone')
      .sort({ updatedAt: -1 })
      .lean();

    const totalSales = orders.reduce((sum, order) => sum + (order.totalPayable || 0), 0);
    const totalOrders = orders.length;

    const dailyBreakdown = {};
    orders.forEach(order => {
      const day = moment(order.updatedAt).utcOffset('+04:00').format('YYYY-MM-DD');  // ✅ UAE
      if (!dailyBreakdown[day]) {
        dailyBreakdown[day] = { date: day, sales: 0, orders: 0 };
      }
      dailyBreakdown[day].sales += order.totalPayable || 0;
      dailyBreakdown[day].orders += 1;
    });

const formatted = orders.flatMap(order =>
  (order.items || []).map(item => ({
    orderId: order._id,
    orderNumber: order.orderNumber || `ORD-${order._id.toString().slice(-6)}`,
    customerName: order.deliveryAddress?.name || order.userId?.name || '-',
    paymentMethod: order.paymentType || 'COD',
    orderDate: moment(order.createdAt).utcOffset('+04:00').format('YYYY-MM-DD'),
    deliveredDate: moment(order.updatedAt).utcOffset('+04:00').format('YYYY-MM-DD'),
    dayOfWeek: moment(order.updatedAt).utcOffset('+04:00').format('dddd'),
    partName: item.snapshot?.partName || '-',
    partNumber: item.snapshot?.partNumber || '-',
    quantity: item.quantity || 1,
    unitPrice: item.snapshot?.discountedPrice ?? item.snapshot?.price ?? 0,
    lineTotal: (item.quantity || 1) * (item.snapshot?.discountedPrice ?? item.snapshot?.price ?? 0),
    orderTotal: Math.round((order.totalPayable || 0) * 100) / 100,
  }))
);

    res.status(200).json({
      success: true,
      period: 'This Week',
      weekStart: nowUAE.clone().startOf('week').format('YYYY-MM-DD'),
      weekEnd: nowUAE.clone().endOf('week').format('YYYY-MM-DD'),
      totalSales: Math.round(totalSales * 100) / 100,
      totalOrders,
      averageOrderValue: totalOrders > 0 ? Math.round((totalSales / totalOrders) * 100) / 100 : 0,
      dateRange: { from: start, to: end },
      dailyBreakdown: Object.values(dailyBreakdown)
        .map(d => ({ ...d, sales: Math.round(d.sales * 100) / 100 }))
        .sort((a, b) => new Date(a.date) - new Date(b.date)),
      data: formatted
    });
  } catch (error) {
    console.error('Shop Weekly Sales Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch weekly sales', error: error.message });
  }
};

// ==================== SHOP MONTHLY SALES ====================
exports.getShopMonthlySales = async (req, res) => {
  try {
    const { shopId, date } = req.query;

    if (!shopId) {
      return res.status(400).json({ success: false, message: 'Shop ID is required' });
    }

    let start, end;
    if (date) {
      const refDate = moment(date).utcOffset('+04:00');
      start = new Date(refDate.clone().startOf('month').format('YYYY-MM-DDTHH:mm:ss') + '+04:00');
      end   = new Date(refDate.clone().endOf('month').format('YYYY-MM-DDTHH:mm:ss') + '+04:00');
    } else {
      const nowUAE = moment().utcOffset('+04:00');
      start = new Date(nowUAE.clone().startOf('month').format('YYYY-MM-DDTHH:mm:ss') + '+04:00');  // ✅
      end   = new Date(nowUAE.clone().endOf('month').format('YYYY-MM-DDTHH:mm:ss') + '+04:00');
    }

    const orders = await Order.find({
      shopId,
      status: 'Delivered',
      updatedAt: { $gte: start, $lte: end }  // ✅ updatedAt
    })
      .populate('userId', 'name email phone')
      .sort({ updatedAt: -1 })
      .lean();

    const totalSales = orders.reduce((sum, order) => sum + (order.totalPayable || 0), 0);
    const totalOrders = orders.length;

    const weeklyBreakdown = {};
    orders.forEach(order => {
      const deliveredUAE = moment(order.updatedAt).utcOffset('+04:00');  // ✅ UAE
      const week = deliveredUAE.week();
      if (!weeklyBreakdown[week]) {
        weeklyBreakdown[week] = {
          week,
          weekStart: deliveredUAE.clone().startOf('week').format('YYYY-MM-DD'),
          sales: 0,
          orders: 0
        };
      }
      weeklyBreakdown[week].sales += order.totalPayable || 0;
      weeklyBreakdown[week].orders += 1;
    });

const formatted = orders.flatMap(order =>
  (order.items || []).map(item => ({
    orderId: order._id,
    orderNumber: order.orderNumber || `ORD-${order._id.toString().slice(-6)}`,
    customerName: order.deliveryAddress?.name || order.userId?.name || '-',
    paymentMethod: order.paymentType || 'COD',
    orderDate: moment(order.createdAt).utcOffset('+04:00').format('YYYY-MM-DD'),
    deliveredDate: moment(order.updatedAt).utcOffset('+04:00').format('YYYY-MM-DD'),
    partName: item.snapshot?.partName || '-',
    partNumber: item.snapshot?.partNumber || '-',
    quantity: item.quantity || 1,
    unitPrice: item.snapshot?.discountedPrice ?? item.snapshot?.price ?? 0,
    lineTotal: (item.quantity || 1) * (item.snapshot?.discountedPrice ?? item.snapshot?.price ?? 0),
    orderTotal: Math.round((order.totalPayable || 0) * 100) / 100,
  }))
);

    res.status(200).json({
      success: true,
      period: 'This Month',
      month: moment().utcOffset('+04:00').format('MMMM YYYY'),
      monthStart: moment(start).utcOffset('+04:00').format('YYYY-MM-DD'),
      monthEnd: moment(end).utcOffset('+04:00').format('YYYY-MM-DD'),
      totalSales: Math.round(totalSales * 100) / 100,
      totalOrders,
      averageOrderValue: totalOrders > 0 ? Math.round((totalSales / totalOrders) * 100) / 100 : 0,
      dateRange: { from: start, to: end },
      weeklyBreakdown: Object.values(weeklyBreakdown)
        .map(w => ({ ...w, sales: Math.round(w.sales * 100) / 100 }))
        .sort((a, b) => a.week - b.week),
      data: formatted
    });
  } catch (error) {
    console.error('Shop Monthly Sales Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch monthly sales', error: error.message });
  }
};

// ========================================
// SHOP PRODUCT PERFORMANCE REPORTS
// ========================================

/**
 * Shop Top Selling Products Report
 * GET /api/report/products/top-selling/by-shop?shopId=xxx
 */
exports.getShopTopSellingProducts = async (req, res) => {
  try {
    const { shopId } = req.query;
    const limit = parseInt(req.query.limit) || 20;

    if (!shopId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Shop ID is required' 
      });
    }

    // ✅ SIMPLE FIX: Just use shopId as-is (MongoDB will handle conversion)
    const shopObjectId = new mongoose.Types.ObjectId(shopId);
    const topProducts = await Order.aggregate([
      { 
        $match: { 
          status: 'Delivered', 
          shopId: shopObjectId // ✅ No conversion needed
        } 
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.shopProductId',
          totalSold: { $sum: '$items.quantity' },
          totalRevenue: { 
            $sum: { $multiply: ['$items.quantity', '$items.snapshot.price'] } 
          },
          partName: { $first: '$items.snapshot.partName' },
          partNumber: { $first: '$items.snapshot.partNumber' },
          category: { $first: '$items.snapshot.category' },
          brand: { $first: '$items.snapshot.brand' }
        }
      },
      {
        $project: {
          productId: '$_id',
          partName: { $ifNull: ['$partName', 'Product'] },
          partNumber: { $ifNull: ['$partNumber', '-'] },
          category: { $ifNull: ['$category', '-'] },
          brand: { $ifNull: ['$brand', '-'] },
          totalSold: 1,
          totalRevenue: { $round: ['$totalRevenue', 2] },
          averagePrice: { 
            $round: [{ $divide: ['$totalRevenue', '$totalSold'] }, 2] 
          }
        }
      },
      { $sort: { totalSold: -1 } },
      { $limit: limit }
    ]);

    res.status(200).json({ 
      success: true, 
      count: topProducts.length,
      data: topProducts 
    });
  } catch (error) {
    console.error('Shop Top Selling Products Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch top selling products', 
      error: error.message 
    });
  }
};

/**
 * Shop Low Selling Products Report
 * GET /api/report/products/low-selling/by-shop?shopId=xxx
 */
exports.getShopLowSellingProducts = async (req, res) => {
  try {
    const { shopId } = req.query;
    const limit = parseInt(req.query.limit) || 20;

    if (!shopId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Shop ID is required' 
      });
    }

    // ✅ SIMPLE FIX: Just use shopId as-is (MongoDB will handle conversion)
      const shopObjectId = new mongoose.Types.ObjectId(shopId);
    const lowProducts = await Order.aggregate([
      { 
        $match: { 
          status: 'Delivered', 
          shopId: shopObjectId  // ✅ No conversion needed
        } 
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.shopProductId',
          totalSold: { $sum: '$items.quantity' },
          totalRevenue: { 
            $sum: { $multiply: ['$items.quantity', '$items.snapshot.price'] } 
          },
          partName: { $first: '$items.snapshot.partName' },
          partNumber: { $first: '$items.snapshot.partNumber' },
          category: { $first: '$items.snapshot.category' },
          brand: { $first: '$items.snapshot.brand' }
        }
      },
      {
        $project: {
          productId: '$_id',
          partName: { $ifNull: ['$partName', 'Product'] },
          partNumber: { $ifNull: ['$partNumber', '-'] },
          category: { $ifNull: ['$category', '-'] },
          brand: { $ifNull: ['$brand', '-'] },
          totalSold: 1,
          totalRevenue: { $round: ['$totalRevenue', 2] }
        }
      },
      { $sort: { totalSold: 1 } },  // Ascending for low selling
      { $limit: limit }
    ]);

    res.status(200).json({ 
      success: true, 
      count: lowProducts.length,
      data: lowProducts 
    });
  } catch (error) {
    console.error('Shop Low Selling Products Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch low selling products', 
      error: error.message 
    });
  }
};

// ========================================
// SHOP INVENTORY REPORTS
// ========================================

/**
 * Shop Low Stock Products Report
 * GET /api/report/stock/low/by-shop?shopId=xxx
 */
exports.getShopLowStockProducts = async (req, res) => {
  try {
    const { shopId } = req.query;
    const threshold = parseInt(req.query.threshold) || 10;

    if (!shopId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Shop ID is required' 
      });
    }

    const lowStockProducts = await ShopProduct.find({
      shopId,
      stock: { $gt: 0, $lte: threshold },
      isActive: true
    })
      .populate('partsCatalogId', 'partName partNumber category brand')
      .sort({ stock: 1 })
      .lean();

    const formatted = lowStockProducts.map(product => ({
      productId: product._id,
      partName: product.partsCatalogId?.partName || product.partName || '-',
      partNumber: product.partsCatalogId?.partNumber || product.partNumber || '-',
      category: product.partsCatalogId?.category || '-',
      brand: product.partsCatalogId?.brand || '-',
      currentStock: product.stock,
      price: Math.round((product.price || 0) * 100) / 100,
      status: product.stock <= 5 ? 'Critical' : 'Low',
      lastUpdated: product.updatedAt
    }));

    res.status(200).json({ 
      success: true, 
      threshold,
      count: formatted.length,
      criticalCount: formatted.filter(p => p.status === 'Critical').length,
      data: formatted 
    });
  } catch (error) {
    console.error('Shop Low Stock Products Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch low stock products', 
      error: error.message 
    });
  }
};

/**
 * Shop Out of Stock Products Report
 * GET /api/report/stock/out-of-stock/by-shop?shopId=xxx
 */
exports.getShopOutOfStockProducts = async (req, res) => {
  try {
    const { shopId } = req.query;

    if (!shopId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Shop ID is required' 
      });
    }

    const outOfStockProducts = await ShopProduct.find({
      shopId,
      stock: 0,
      isActive: true
    })
      .populate('partsCatalogId', 'partName partNumber category brand')
      .sort({ updatedAt: -1 })
      .lean();

    const formatted = outOfStockProducts.map(product => ({
      productId: product._id,
      partName: product.partsCatalogId?.partName || product.partName || '-',
      partNumber: product.partsCatalogId?.partNumber || product.partNumber || '-',
      category: product.partsCatalogId?.category || '-',
      brand: product.partsCatalogId?.brand || '-',
      price: Math.round((product.price || 0) * 100) / 100,
      outOfStockSince: product.updatedAt,
      daysOutOfStock: moment().diff(moment(product.updatedAt), 'days')
    }));

    res.status(200).json({ 
      success: true, 
      count: formatted.length,
      data: formatted 
    });
  } catch (error) {
    console.error('Shop Out of Stock Products Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch out of stock products', 
      error: error.message 
    });
  }
};

/**
 * Shop Sales by ID Report (Overall Shop Performance)
 * GET /api/report/shop-sales/by-id?shopId=xxx
 */
exports.getShopSalesById = async (req, res) => {
  try {
    const { shopId } = req.query;

    if (!shopId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Shop ID is required' 
      });
    }

    // Get all delivered orders for the shop
    const orders = await Order.find({
      shopId,
      status: 'Delivered'
    }).lean();

    const totalOrders = orders.length;
    const totalSales = orders.reduce((sum, order) => sum + (order.totalPayable || 0), 0);
    const totalItems = orders.reduce((sum, order) => sum + (order.items?.length || 0), 0);

    // Calculate monthly stats
    const currentMonth = moment().startOf('month');
    const monthlyOrders = orders.filter(o => 
      moment(o.createdAt).isSameOrAfter(currentMonth)
    );
    const monthlySales = monthlyOrders.reduce((sum, order) => sum + (order.totalPayable || 0), 0);

    // Calculate previous month for comparison
    const previousMonth = moment().subtract(1, 'month').startOf('month');
    const previousMonthEnd = moment().subtract(1, 'month').endOf('month');
    const previousMonthOrders = orders.filter(o => 
      moment(o.createdAt).isBetween(previousMonth, previousMonthEnd, null, '[]')
    );
    const previousMonthSales = previousMonthOrders.reduce((sum, order) => sum + (order.totalPayable || 0), 0);

    // Calculate growth percentage
    const growthPercentage = previousMonthSales > 0 
      ? Math.round(((monthlySales - previousMonthSales) / previousMonthSales) * 10000) / 100
      : 0;

    res.status(200).json({ 
      success: true,
      shopId,
      summary: {
        totalOrders,
        totalSales: Math.round(totalSales * 100) / 100,
        totalItems,
        averageOrderValue: totalOrders > 0 ? Math.round((totalSales / totalOrders) * 100) / 100 : 0
      },
      thisMonth: {
        orders: monthlyOrders.length,
        sales: Math.round(monthlySales * 100) / 100,
        averageOrderValue: monthlyOrders.length > 0 ? Math.round((monthlySales / monthlyOrders.length) * 100) / 100 : 0
      },
      previousMonth: {
        orders: previousMonthOrders.length,
        sales: Math.round(previousMonthSales * 100) / 100
      },
      growth: {
        percentage: growthPercentage,
        trend: growthPercentage >= 0 ? 'up' : 'down'
      }
    });
  } catch (error) {
    console.error('Shop Sales By ID Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch shop sales', 
      error: error.message 
    });
  }
};


// ========================================
// AGENCY FINANCIAL PERFORMANCE REPORT
// ========================================

/**
 * Agency Financial Performance Report
 * GET /api/report/agency/financial?agencyId=xxx&period=month
 * 
 * Comprehensive financial overview including:
 * - Total earnings breakdown
 * - Payout status (pending/paid)
 * - Revenue trends
 * - Payment method distribution
 */
exports.getAgencyFinancialReport = async (req, res) => {
  try {
    const { agencyId, period = 'all' } = req.query;

    if (!agencyId) {
      return res.status(400).json({ success: false, message: 'Agency ID is required' });
    }

    let startDate, endDate;

    switch (period) {
      case 'today':
        startDate = moment().startOf('day').toDate();
        endDate = moment().endOf('day').toDate();
        break;
      case 'week':
        startDate = moment().startOf('week').toDate();
        endDate = moment().endOf('week').toDate();
        break;
      case 'month':
        startDate = moment().startOf('month').toDate();
        endDate = moment().endOf('month').toDate();
        break;
      case 'year':
        startDate = moment().startOf('year').toDate();
        endDate = moment().endOf('year').toDate();
        break;
      case 'all':
      default:
        startDate = new Date(0);
        endDate = new Date();
        break;
    }

    const orders = await Order.find({
      agencyId: new mongoose.Types.ObjectId(agencyId),
      status: 'Delivered',
      createdAt: { $gte: startDate, $lte: endDate }
    })
      .populate('assignedDeliveryBoy', 'name email')
      .populate('shopId', 'shopeDetails.shopName')
      .lean();

    const totalOrders = orders.length;
    const totalEarnings = orders.reduce((sum, order) => sum + (order.deliveryEarning || 0), 0);
    const totalDeliveryCharges = orders.reduce((sum, order) => sum + (order.deliveryCharge || 0), 0);
    const totalDistance = orders.reduce((sum, order) => sum + (order.deliveryDistance || 0), 0);

    const avgEarningPerOrder = totalOrders > 0 ? totalEarnings / totalOrders : 0;
    const avgDeliveryCharge = totalOrders > 0 ? totalDeliveryCharges / totalOrders : 0;
    const avgDistance = totalOrders > 0 ? totalDistance / totalOrders : 0;

    const payouts = await AgencyPayout.find({
      agencyId: new mongoose.Types.ObjectId(agencyId),
      from: { $gte: startDate },
      to: { $lte: endDate }
    }).lean();

    const paidPayouts = payouts.filter(p => p.status === 'Paid');
    const pendingPayouts = payouts.filter(p => p.status === 'Pending');

    const totalPaid = paidPayouts.reduce((sum, p) => sum + (p.totalEarnings || 0), 0);
    const totalPending = pendingPayouts.reduce((sum, p) => sum + (p.totalEarnings || 0), 0);

    const dailyBreakdown = {};
    orders.forEach(order => {
      const day = moment(order.createdAt).format('YYYY-MM-DD');
      if (!dailyBreakdown[day]) {
        dailyBreakdown[day] = { date: day, orders: 0, earnings: 0, distance: 0 };
      }
      dailyBreakdown[day].orders += 1;
      dailyBreakdown[day].earnings += order.deliveryEarning || 0;
      dailyBreakdown[day].distance += order.deliveryDistance || 0;
    });

    const deliveryBoyBreakdown = {};
    orders.forEach(order => {
      if (order.assignedDeliveryBoy) {
        const boyId = order.assignedDeliveryBoy._id.toString();
        if (!deliveryBoyBreakdown[boyId]) {
          deliveryBoyBreakdown[boyId] = {
            deliveryBoyId: boyId,
            name: order.assignedDeliveryBoy.name,
            orders: 0,
            earnings: 0,
            distance: 0
          };
        }
        deliveryBoyBreakdown[boyId].orders += 1;
        deliveryBoyBreakdown[boyId].earnings += order.deliveryEarning || 0;
        deliveryBoyBreakdown[boyId].distance += order.deliveryDistance || 0;
      }
    });

    const topDeliveryBoys = Object.values(deliveryBoyBreakdown)
      .sort((a, b) => b.earnings - a.earnings)
      .slice(0, 10);

    const paymentMethodStats = orders.reduce((acc, order) => {
      const method = order.paymentType || 'COD';
      acc[method] = (acc[method] || 0) + 1;
      return acc;
    }, {});

    // ── Flat data array for DynamicTableController ──────────────────────────
    const dailyBreakdownSorted = Object.values(dailyBreakdown)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    const tableData = dailyBreakdownSorted.map(d => ({
      date: d.date,
      orders: d.orders,
      earnings: Math.round(d.earnings * 100) / 100,
      distance: Math.round(d.distance * 100) / 100,
      avgEarningPerOrder: d.orders > 0 ? Math.round((d.earnings / d.orders) * 100) / 100 : 0,
    }));

    res.status(200).json({
      success: true,
      period,
      dateRange: { from: startDate, to: endDate },
      summary: {
        totalOrders,
        totalEarnings: Math.round(totalEarnings * 100) / 100,
        totalDeliveryCharges: Math.round(totalDeliveryCharges * 100) / 100,
        totalDistance: Math.round(totalDistance * 100) / 100,
        avgEarningPerOrder: Math.round(avgEarningPerOrder * 100) / 100,
        avgDeliveryCharge: Math.round(avgDeliveryCharge * 100) / 100,
        avgDistance: Math.round(avgDistance * 100) / 100
      },
      payouts: {
        totalPaid: Math.round(totalPaid * 100) / 100,
        totalPending: Math.round(totalPending * 100) / 100,
        paidCount: paidPayouts.length,
        pendingCount: pendingPayouts.length
      },
      dailyBreakdown: dailyBreakdownSorted.map(d => ({
        ...d,
        earnings: Math.round(d.earnings * 100) / 100,
        distance: Math.round(d.distance * 100) / 100
      })),
      topDeliveryBoys: topDeliveryBoys.map(boy => ({
        ...boy,
        earnings: Math.round(boy.earnings * 100) / 100,
        distance: Math.round(boy.distance * 100) / 100,
        avgEarningPerOrder: boy.orders > 0 ? Math.round((boy.earnings / boy.orders) * 100) / 100 : 0
      })),
      paymentMethodDistribution: paymentMethodStats,
      data: tableData,   // ← DynamicTableController reads this
    });

  } catch (error) {
    console.error('Agency Financial Report Error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate financial report', error: error.message });
  }
};


exports.getDeliveryBoyPerformanceReport = async (req, res) => {
  try {
    const { agencyId, period = 'all' } = req.query;

    if (!agencyId) {
      return res.status(400).json({ success: false, message: 'Agency ID is required' });
    }

    let startDate, endDate;

    switch (period) {
      case 'today':
        startDate = moment().startOf('day').toDate();
        endDate = moment().endOf('day').toDate();
        break;
      case 'week':
        startDate = moment().startOf('week').toDate();
        endDate = moment().endOf('week').toDate();
        break;
      case 'month':
        startDate = moment().startOf('month').toDate();
        endDate = moment().endOf('month').toDate();
        break;
      case 'year':
        startDate = moment().startOf('year').toDate();
        endDate = moment().endOf('year').toDate();
        break;
      case 'all':
      default:
        startDate = new Date(0);
        endDate = new Date();
        break;
    }

    const deliveryBoys = await mongoose.model('DeliveryBoy').find({
      agencyId: new mongoose.Types.ObjectId(agencyId)
    }).lean();

    if (!deliveryBoys.length) {
      return res.status(200).json({
        success: true,
        message: 'No delivery boys found for this agency',
        data: []
      });
    }

    const deliveryBoyIds = deliveryBoys.map(db => db._id);

    const orders = await Order.find({
      assignedDeliveryBoy: { $in: deliveryBoyIds },
      createdAt: { $gte: startDate, $lte: endDate }
    }).lean();

    const performanceData = deliveryBoys.map(boy => {
      const boyOrders = orders.filter(o =>
        o.assignedDeliveryBoy?.toString() === boy._id.toString()
      );

      const totalOrders = boyOrders.length;
      const deliveredOrders = boyOrders.filter(o => o.status === 'Delivered').length;
      const cancelledOrders = boyOrders.filter(o => o.status === 'Cancelled').length;
      const pendingOrders = boyOrders.filter(o =>
        !['Delivered', 'Cancelled'].includes(o.status)
      ).length;

      const totalEarnings = boyOrders
        .filter(o => o.status === 'Delivered')
        .reduce((sum, o) => sum + (o.deliveryEarning || 0), 0);

      const totalDistance = boyOrders
        .filter(o => o.status === 'Delivered')
        .reduce((sum, o) => sum + (o.deliveryDistance || 0), 0);

      const deliveryTimes = boyOrders
        .filter(o => o.status === 'Delivered' && o.deliveredAt && o.createdAt)
        .map(o => {
          const start = new Date(o.createdAt);
          const end = new Date(o.deliveredAt);
          return (end - start) / (1000 * 60);
        });

      const avgDeliveryTime = deliveryTimes.length > 0
        ? deliveryTimes.reduce((sum, t) => sum + t, 0) / deliveryTimes.length
        : 0;

      const successRate = totalOrders > 0 ? (deliveredOrders / totalOrders) * 100 : 0;
      const avgEarningPerDelivery = deliveredOrders > 0 ? totalEarnings / deliveredOrders : 0;
      const avgDistancePerDelivery = deliveredOrders > 0 ? totalDistance / deliveredOrders : 0;
      const efficiencyScore = totalDistance > 0 ? deliveredOrders / totalDistance : 0;

      const rating = successRate >= 90 ? 'Excellent' :
                     successRate >= 75 ? 'Good' :
                     successRate >= 50 ? 'Average' : 'Poor';

      const strengths = [];
      const improvements = [];

      if (successRate >= 90) strengths.push('High success rate');
      if (avgDeliveryTime < 30 && avgDeliveryTime > 0) strengths.push('Fast delivery times');
      if (efficiencyScore > 0.5) strengths.push('Efficient route planning');
      if (successRate < 75) improvements.push('Improve completion rate');
      if (avgDeliveryTime > 45) improvements.push('Reduce delivery time');
      if (cancelledOrders > deliveredOrders * 0.2) improvements.push('Reduce cancellations');

      return {
        deliveryBoyId: boy._id,
        name: boy.name,
        email: boy.email,
        phone: boy.phone,
        isOnline: boy.isOnline || false,
        metrics: {
          totalOrders,
          deliveredOrders,
          cancelledOrders,
          pendingOrders,
          successRate: Math.round(successRate * 100) / 100,
          totalEarnings: Math.round(totalEarnings * 100) / 100,
          totalDistance: Math.round(totalDistance * 100) / 100,
          avgDeliveryTime: Math.round(avgDeliveryTime * 100) / 100,
          avgEarningPerDelivery: Math.round(avgEarningPerDelivery * 100) / 100,
          avgDistancePerDelivery: Math.round(avgDistancePerDelivery * 100) / 100,
          efficiencyScore: Math.round(efficiencyScore * 1000) / 1000
        },
        performance: { rating, strengths, improvements }
      };
    });

    performanceData.sort((a, b) => b.metrics.totalEarnings - a.metrics.totalEarnings);

    const agencyStats = {
      totalDeliveryBoys: deliveryBoys.length,
      activeDeliveryBoys: deliveryBoys.filter(b => b.isOnline).length,
      totalOrders: performanceData.reduce((sum, b) => sum + b.metrics.totalOrders, 0),
      totalDelivered: performanceData.reduce((sum, b) => sum + b.metrics.deliveredOrders, 0),
      avgSuccessRate: performanceData.length > 0
        ? Math.round((performanceData.reduce((sum, b) => sum + b.metrics.successRate, 0) / performanceData.length) * 100) / 100
        : 0
    };

    // ── Flat data array for DynamicTableController ──────────────────────────
    const tableData = performanceData.map(boy => ({
      name: boy.name,
      email: boy.email,
      phone: boy.phone,
      status: boy.isOnline ? 'Online' : 'Offline',
      totalOrders: boy.metrics.totalOrders,
      delivered: boy.metrics.deliveredOrders,
      cancelled: boy.metrics.cancelledOrders,
      pending: boy.metrics.pendingOrders,
      successRate: boy.metrics.successRate,
      totalEarnings: boy.metrics.totalEarnings,
      totalDistance: boy.metrics.totalDistance,
      avgDeliveryTime: boy.metrics.avgDeliveryTime,
      avgEarningPerDelivery: boy.metrics.avgEarningPerDelivery,
      rating: boy.performance.rating,
    }));

    res.status(200).json({
      success: true,
      period,
      dateRange: { from: startDate, to: endDate },
      agencyStats,
      deliveryBoys: performanceData,
      data: tableData,   // ← DynamicTableController reads this
    });

  } catch (error) {
    console.error('Delivery Boy Performance Report Error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate performance report', error: error.message });
  }
};


exports.getAgencyOrderSuccessReport = async (req, res) => {
  try {
    const { agencyId, period = 'all' } = req.query;

    if (!agencyId) {
      return res.status(400).json({ success: false, message: 'Agency ID is required' });
    }

    let startDate, endDate;

    switch (period) {
      case 'today':
        startDate = moment().startOf('day').toDate();
        endDate = moment().endOf('day').toDate();
        break;
      case 'week':
        startDate = moment().startOf('week').toDate();
        endDate = moment().endOf('week').toDate();
        break;
      case 'month':
        startDate = moment().startOf('month').toDate();
        endDate = moment().endOf('month').toDate();
        break;
      case 'year':
        startDate = moment().startOf('year').toDate();
        endDate = moment().endOf('year').toDate();
        break;
      case 'all':
      default:
        startDate = new Date(0);
        endDate = new Date();
        break;
    }

    const orders = await Order.find({
      agencyId: new mongoose.Types.ObjectId(agencyId),
      createdAt: { $gte: startDate, $lte: endDate }
    })
      .populate('shopId', 'shopeDetails.shopName')
      .populate('assignedDeliveryBoy', 'name')
      .lean();

    const totalOrders = orders.length;

    const statusDistribution = orders.reduce((acc, order) => {
      const status = order.status || 'Unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    const delivered = statusDistribution['Delivered'] || 0;
    const cancelled = statusDistribution['Cancelled'] || 0;
    const pending = Object.keys(statusDistribution)
      .filter(s => !['Delivered', 'Cancelled'].includes(s))
      .reduce((sum, s) => sum + statusDistribution[s], 0);

    const successRate = totalOrders > 0 ? (delivered / totalOrders) * 100 : 0;
    const cancellationRate = totalOrders > 0 ? (cancelled / totalOrders) * 100 : 0;

    const cancelledOrders = orders.filter(o => o.status === 'Cancelled');
    const cancellationReasons = cancelledOrders.reduce((acc, order) => {
      const reason = order.cancellation?.reason || 'Not specified';
      const cancelledBy = order.cancellation?.cancelledBy || 'unknown';
      const key = `${cancelledBy}: ${reason}`;
      if (!acc[key]) {
        acc[key] = { reason, cancelledBy, count: 0, percentage: 0 };
      }
      acc[key].count += 1;
      return acc;
    }, {});

    Object.values(cancellationReasons).forEach(r => {
      r.percentage = cancelled > 0 ? Math.round((r.count / cancelled) * 10000) / 100 : 0;
    });

    const deliveredOrders = orders.filter(o => o.status === 'Delivered' && o.deliveredAt);
    const lifecycleTimes = deliveredOrders.map(o => {
      const start = new Date(o.createdAt);
      const end = new Date(o.deliveredAt);
      return (end - start) / (1000 * 60);
    });

    const avgLifecycleTime = lifecycleTimes.length > 0
      ? lifecycleTimes.reduce((sum, t) => sum + t, 0) / lifecycleTimes.length
      : 0;

    const hourlyDistribution = {};
    orders.forEach(order => {
      const hour = moment(order.createdAt).hour();
      hourlyDistribution[hour] = (hourlyDistribution[hour] || 0) + 1;
    });

    const peakHours = Object.entries(hourlyDistribution)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([hour, count]) => ({
        hour: parseInt(hour),
        timeSlot: `${hour}:00 - ${parseInt(hour) + 1}:00`,
        orders: count
      }));

    const shopPerformance = {};
    orders.forEach(order => {
      if (order.shopId) {
        const shopId = order.shopId._id.toString();
        const shopName = order.shopId.shopeDetails?.shopName || 'Unknown Shop';
        if (!shopPerformance[shopId]) {
          shopPerformance[shopId] = { shopId, shopName, totalOrders: 0, delivered: 0, cancelled: 0, successRate: 0 };
        }
        shopPerformance[shopId].totalOrders += 1;
        if (order.status === 'Delivered') shopPerformance[shopId].delivered += 1;
        if (order.status === 'Cancelled') shopPerformance[shopId].cancelled += 1;
      }
    });

    Object.values(shopPerformance).forEach(shop => {
      shop.successRate = shop.totalOrders > 0
        ? Math.round((shop.delivered / shop.totalOrders) * 10000) / 100
        : 0;
    });

    const topPerformingShops = Object.values(shopPerformance)
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, 10);

    const dailyTrends = {};
    orders.forEach(order => {
      const day = moment(order.createdAt).format('YYYY-MM-DD');
      if (!dailyTrends[day]) {
        dailyTrends[day] = { date: day, total: 0, delivered: 0, cancelled: 0, successRate: 0 };
      }
      dailyTrends[day].total += 1;
      if (order.status === 'Delivered') dailyTrends[day].delivered += 1;
      if (order.status === 'Cancelled') dailyTrends[day].cancelled += 1;
    });

    Object.values(dailyTrends).forEach(day => {
      day.successRate = day.total > 0
        ? Math.round((day.delivered / day.total) * 10000) / 100
        : 0;
    });

    const dailyTrendsSorted = Object.values(dailyTrends)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    // ── Flat data array for DynamicTableController ──────────────────────────
    const tableData = dailyTrendsSorted.map(d => ({
      date: d.date,
      totalOrders: d.total,
      delivered: d.delivered,
      cancelled: d.cancelled,
      pending: d.total - d.delivered - d.cancelled,
      successRate: d.successRate,
    }));

    res.status(200).json({
      success: true,
      period,
      dateRange: { from: startDate, to: endDate },
      summary: {
        totalOrders,
        delivered,
        cancelled,
        pending,
        successRate: Math.round(successRate * 100) / 100,
        cancellationRate: Math.round(cancellationRate * 100) / 100,
        avgLifecycleTime: Math.round(avgLifecycleTime * 100) / 100,
        qualityGrade: successRate >= 95 ? 'A+' :
                      successRate >= 90 ? 'A' :
                      successRate >= 85 ? 'B+' :
                      successRate >= 80 ? 'B' :
                      successRate >= 75 ? 'C' : 'D'
      },
      statusDistribution,
      cancellationAnalysis: {
        totalCancelled: cancelled,
        reasons: Object.values(cancellationReasons).sort((a, b) => b.count - a.count)
      },
      peakHours,
      topPerformingShops,
      dailyTrends: dailyTrendsSorted,
      data: tableData,   // ← DynamicTableController reads this
    });

  } catch (error) {
    console.error('Agency Order Success Report Error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate order success report', error: error.message });
  }
};