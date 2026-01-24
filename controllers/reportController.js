const Order = require('../models/Order');
const Payment = require('../models/Payment');
const ShopProduct = require('../models/ShopProduct');
const Stock = require('../models/Stock');
const User = require('../models/User');
const Coupon = require('../models/Coupon');
const moment = require('moment');
const { Shop } = require('../models/Shop');
const { AgencyPayout } = require('../models/AgencyPayout');
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
        cancelReason: order.cancelReason || '-'
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
    const start = moment().startOf('day').toDate();
    const end = moment().endOf('day').toDate();

    const orders = await Order.find({
      status: 'Delivered',
      createdAt: { $gte: start, $lte: end }
    })
    .populate('shopId', 'shopeDetails.shopName')
    .lean();

    const total = orders.reduce((sum, order) => sum + (order.totalPayable || 0), 0);

    const formatted = orders.map(order => ({
      orderId: order._id,
      orderDate: order.createdAt,
      shopName: order.shopId?.shopeDetails?.shopName || 'Unknown',
      customerName: order.deliveryAddress?.name || '-',
      itemCount: order.items?.length || 0,
      subtotal: order.subtotal,
      discount: order.discount,
      deliveryCharge: order.deliveryCharge,
      totalAmount: order.totalPayable,
      paymentMethod: order.paymentType
    }));

    res.status(200).json({ 
      success: true, 
      totalSales: Math.round(total * 100) / 100,
      count: orders.length,
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

    const formatted = orders.map(order => ({
      orderId: order._id,
      orderDate: order.createdAt,
      shopName: order.shopId?.shopeDetails?.shopName || 'Unknown',
      customerName: order.deliveryAddress?.name || '-',
      itemCount: order.items?.length || 0,
      totalAmount: order.totalPayable,
      paymentMethod: order.paymentType
    }));

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
    const start = moment().startOf('month').toDate();
    const end = moment().endOf('month').toDate();

    const orders = await Order.find({
      status: 'Delivered',
      createdAt: { $gte: start, $lte: end }
    })
    .populate('shopId', 'shopeDetails.shopName')
    .lean();

    const total = orders.reduce((sum, order) => sum + (order.totalPayable || 0), 0);

    const formatted = orders.map(order => ({
      orderId: order._id,
      orderDate: order.createdAt,
      shopName: order.shopId?.shopeDetails?.shopName || 'Unknown',
      customerName: order.deliveryAddress?.name || '-',
      itemCount: order.items?.length || 0,
      totalAmount: order.totalPayable,
      paymentMethod: order.paymentType
    }));

    res.status(200).json({ 
      success: true, 
      totalSales: Math.round(total * 100) / 100,
      count: orders.length,
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
    const topProducts = await Order.aggregate([
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
        { $sort: { totalSold: -1 } },
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

    res.status(200).json({ success: true, data: topProducts });
  } catch (error) {
    console.error('Top Selling Products Error:', error);
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
        cancelReason: order.cancelReason || '-'
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

// Shop Daily/Weekly/Monthly Sales (same pattern)
exports.getShopDailySales = async (req, res) => {
  try {
    const { shopId } = req.query;
    const start = moment().startOf('day').toDate();
    const end = moment().endOf('day').toDate();

    const orders = await Order.find({
      status: 'Delivered',
      shopId,
      createdAt: { $gte: start, $lte: end }
    }).lean();

    const total = orders.reduce((sum, order) => sum + (order.totalPayable || 0), 0);

    res.status(200).json({ 
      success: true, 
      totalSales: Math.round(total * 100) / 100,
      count: orders.length,
      data: orders.map(o => ({
        orderId: o._id,
        customerName: o.deliveryAddress?.name || '-',
        totalAmount: o.totalPayable,
        orderDate: o.createdAt
      }))
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch daily sales', 
      error: err.message 
    });
  }
};

exports.getShopWeeklySales = async (req, res) => {
  try {
    const { shopId } = req.query;
    const start = moment().startOf('week').toDate();
    const end = moment().endOf('week').toDate();

    const orders = await Order.find({
      status: 'Delivered',
      shopId,
      createdAt: { $gte: start, $lte: end }
    }).lean();

    const total = orders.reduce((sum, order) => sum + (order.totalPayable || 0), 0);

    res.status(200).json({ 
      success: true, 
      totalSales: Math.round(total * 100) / 100,
      count: orders.length,
      data: orders 
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch weekly sales', 
      error: err.message 
    });
  }
};

exports.getShopMonthlySales = async (req, res) => {
  try {
    const { shopId } = req.query;
    const start = moment().startOf('month').toDate();
    const end = moment().endOf('month').toDate();

    const orders = await Order.find({
      status: 'Delivered',
      shopId,
      createdAt: { $gte: start, $lte: end }
    }).lean();

    const total = orders.reduce((sum, order) => sum + (order.totalPayable || 0), 0);

    res.status(200).json({ 
      success: true, 
      totalSales: Math.round(total * 100) / 100,
      count: orders.length,
      data: orders 
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch monthly sales', 
      error: err.message 
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
 * Shop Cancelled Orders Report
 * GET /api/report/orders/cancelled/by-shop?shopId=xxx
 */
exports.getShopCancelledOrders = async (req, res) => {
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
      status: 'Cancelled'
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
      cancellationReason: order.cancellationReason || '-',
      cancelledAt: order.updatedAt,
      orderDate: order.createdAt,
      refundStatus: order.refundStatus || 'N/A'
    }));

    res.status(200).json({ 
      success: true, 
      count: formatted.length,
      totalLostRevenue: formatted.reduce((sum, o) => sum + o.totalAmount, 0),
      data: formatted 
    });
  } catch (error) {
    console.error('Shop Cancelled Orders Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch cancelled orders', 
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

/**
 * Shop Daily Sales Report
 * GET /api/report/sales/daily/by-shop?shopId=xxx
 */
exports.getShopDailySales = async (req, res) => {
  try {
    const { shopId } = req.query;

    if (!shopId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Shop ID is required' 
      });
    }

    const startOfDay = moment().startOf('day').toDate();
    const endOfDay = moment().endOf('day').toDate();

    const orders = await Order.find({
      shopId,
      status: 'Delivered',
      createdAt: { $gte: startOfDay, $lte: endOfDay }
    })
      .populate('userId', 'name email phone')
      .sort({ createdAt: -1 })
      .lean();

    const totalSales = orders.reduce((sum, order) => sum + (order.totalPayable || 0), 0);
    const totalOrders = orders.length;

    const formatted = orders.map(order => ({
      orderId: order._id,
      orderNumber: order.orderNumber || `ORD-${order._id.toString().slice(-6)}`,
      customerName: order.deliveryAddress?.name || order.userId?.name || '-',
      itemCount: order.items?.length || 0,
      totalAmount: Math.round((order.totalPayable || 0) * 100) / 100,
      paymentMethod: order.paymentType || 'COD',
      orderTime: order.createdAt,
      deliveredTime: order.updatedAt
    }));

    res.status(200).json({ 
      success: true, 
      period: 'Today',
      date: moment().format('YYYY-MM-DD'),
      totalSales: Math.round(totalSales * 100) / 100,
      totalOrders,
      averageOrderValue: totalOrders > 0 ? Math.round((totalSales / totalOrders) * 100) / 100 : 0,
      data: formatted 
    });
  } catch (error) {
    console.error('Shop Daily Sales Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch daily sales', 
      error: error.message 
    });
  }
};

/**
 * Shop Weekly Sales Report
 * GET /api/report/sales/weekly/by-shop?shopId=xxx
 */
exports.getShopWeeklySales = async (req, res) => {
  try {
    const { shopId } = req.query;

    if (!shopId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Shop ID is required' 
      });
    }

    const startOfWeek = moment().startOf('week').toDate();
    const endOfWeek = moment().endOf('week').toDate();

    const orders = await Order.find({
      shopId,
      status: 'Delivered',
      createdAt: { $gte: startOfWeek, $lte: endOfWeek }
    })
      .populate('userId', 'name email phone')
      .sort({ createdAt: -1 })
      .lean();

    const totalSales = orders.reduce((sum, order) => sum + (order.totalPayable || 0), 0);
    const totalOrders = orders.length;

    // Group by day for daily breakdown
    const dailyBreakdown = {};
    orders.forEach(order => {
      const day = moment(order.createdAt).format('YYYY-MM-DD');
      if (!dailyBreakdown[day]) {
        dailyBreakdown[day] = { date: day, sales: 0, orders: 0 };
      }
      dailyBreakdown[day].sales += order.totalPayable || 0;
      dailyBreakdown[day].orders += 1;
    });

    const formatted = orders.map(order => ({
      orderId: order._id,
      orderNumber: order.orderNumber || `ORD-${order._id.toString().slice(-6)}`,
      customerName: order.deliveryAddress?.name || order.userId?.name || '-',
      itemCount: order.items?.length || 0,
      totalAmount: Math.round((order.totalPayable || 0) * 100) / 100,
      orderDate: moment(order.createdAt).format('YYYY-MM-DD'),
      dayOfWeek: moment(order.createdAt).format('dddd')
    }));

    res.status(200).json({ 
      success: true, 
      period: 'This Week',
      weekStart: moment(startOfWeek).format('YYYY-MM-DD'),
      weekEnd: moment(endOfWeek).format('YYYY-MM-DD'),
      totalSales: Math.round(totalSales * 100) / 100,
      totalOrders,
      averageOrderValue: totalOrders > 0 ? Math.round((totalSales / totalOrders) * 100) / 100 : 0,
      dailyBreakdown: Object.values(dailyBreakdown).map(d => ({
        ...d,
        sales: Math.round(d.sales * 100) / 100
      })),
      data: formatted 
    });
  } catch (error) {
    console.error('Shop Weekly Sales Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch weekly sales', 
      error: error.message 
    });
  }
};

/**
 * Shop Monthly Sales Report
 * GET /api/report/sales/monthly/by-shop?shopId=xxx
 */
exports.getShopMonthlySales = async (req, res) => {
  try {
    const { shopId } = req.query;

    if (!shopId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Shop ID is required' 
      });
    }

    const startOfMonth = moment().startOf('month').toDate();
    const endOfMonth = moment().endOf('month').toDate();

    const orders = await Order.find({
      shopId,
      status: 'Delivered',
      createdAt: { $gte: startOfMonth, $lte: endOfMonth }
    })
      .populate('userId', 'name email phone')
      .sort({ createdAt: -1 })
      .lean();

    const totalSales = orders.reduce((sum, order) => sum + (order.totalPayable || 0), 0);
    const totalOrders = orders.length;

    // Group by week for weekly breakdown
    const weeklyBreakdown = {};
    orders.forEach(order => {
      const week = moment(order.createdAt).week();
      if (!weeklyBreakdown[week]) {
        weeklyBreakdown[week] = { 
          week, 
          weekStart: moment(order.createdAt).startOf('week').format('YYYY-MM-DD'),
          sales: 0, 
          orders: 0 
        };
      }
      weeklyBreakdown[week].sales += order.totalPayable || 0;
      weeklyBreakdown[week].orders += 1;
    });

    const formatted = orders.map(order => ({
      orderId: order._id,
      orderNumber: order.orderNumber || `ORD-${order._id.toString().slice(-6)}`,
      customerName: order.deliveryAddress?.name || order.userId?.name || '-',
      itemCount: order.items?.length || 0,
      totalAmount: Math.round((order.totalPayable || 0) * 100) / 100,
      orderDate: moment(order.createdAt).format('YYYY-MM-DD')
    }));

    res.status(200).json({ 
      success: true, 
      period: 'This Month',
      month: moment().format('MMMM YYYY'),
      monthStart: moment(startOfMonth).format('YYYY-MM-DD'),
      monthEnd: moment(endOfMonth).format('YYYY-MM-DD'),
      totalSales: Math.round(totalSales * 100) / 100,
      totalOrders,
      averageOrderValue: totalOrders > 0 ? Math.round((totalSales / totalOrders) * 100) / 100 : 0,
      weeklyBreakdown: Object.values(weeklyBreakdown).map(w => ({
        ...w,
        sales: Math.round(w.sales * 100) / 100
      })),
      data: formatted 
    });
  } catch (error) {
    console.error('Shop Monthly Sales Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch monthly sales', 
      error: error.message 
    });
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

