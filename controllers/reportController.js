const Product = require('../models/Product');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const moment = require('moment');
const { Shop } = require('../models/Shop');
// Shop Wise Sales
exports.getShopWiseSales = async (req, res) => {
  try {
    const result = await Order.aggregate([
      {
        $match: {
          orderStatus: 'Delivered'
        }
      },
      {
        $addFields: {
          shopObjectId: {
            $toObjectId: "$shopId"
          }
        }
      },
      {
        $group: {
          _id: "$shopObjectId",
          totalOrders: { $sum: 1 },
          totalSales: {
            $sum: {
              $toDouble: "$finalPayable"
            }
          }
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
      { $unwind: "$shopInfo" },
      {
        $project: {
          shopId: "$_id",
          totalOrders: 1,
          totalSales: 1,
          shopName: "$shopInfo.shopeDetails.shopName",
          shopEmail: "$shopInfo.shopeDetails.shopMail",
          shopContact: "$shopInfo.shopeDetails.shopContact"
        }
      }
    ]);

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch shop wise sales", error });
  }
};

// Get all cancelled orders
exports.getCancelledOrders = async (req, res) => {
  try {
    const cancelledOrders = await Order.find({ orderStatus: 'Cancelled' });

    const formatted = cancelledOrders.map(order => {
      return order.products.map(p => ({
        _id: order._id,
        userId: order.userId,
        orderStatus: order.orderStatus,
        partNumber: p.partNumber,
        partName: p.partName,
        totalAmount: order.totalAmount,
        finalPayable: order.finalPayable,
        productId: p.productId,
        quantity: p.quantity,
        name: order.deliveryAddress?.name,
        contact: order.deliveryAddress?.contact,
        address: order.deliveryAddress?.address,
        area: order.deliveryAddress?.area,
        brand: p.brand,
        year: p.year,
        model: p.model
      }));
    }).flat();

    res.status(200).json({ success: true, data: formatted });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch cancelled orders', error });
  }
};

// Get all returned orders
exports.getReturnedOrders = async (req, res) => {
  try {
    const returnedOrders = await Order.find({ orderStatus: 'Returned' });

    const formatted = returnedOrders.map(order => {
      return order.products.map(p => ({
        _id: order._id,
        userId: order.userId,
        orderStatus: order.orderStatus,
        partNumber: p.partNumber,
        partName: p.partName,
        totalAmount: order.totalAmount,
        finalPayable: order.finalPayable,
        productId: p.productId,
        quantity: p.quantity,
        name: order.deliveryAddress?.name,
        contact: order.deliveryAddress?.contact,
        address: order.deliveryAddress?.address,
        area: order.deliveryAddress?.area,
        brand: p.brand,
        year: p.year,
        model: p.model
      }));
    }).flat();

    res.status(200).json({ success: true, data: formatted });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch returned orders', error });
  }
};

// Daily Sales
exports.getDailySales = async (req, res) => {
  try {
    const start = moment().startOf('day');
    const end = moment().endOf('day');

    const payments = await Payment.find({
      paymentStatus: 'Paid',
      paymentDate: { $gte: start.toDate(), $lte: end.toDate() }
    });

    const total = payments.reduce((sum, p) => sum + p.amount, 0);

    res.status(200).json({ success: true, totalSales: total, count: payments.length, data: payments });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch daily sales', error: err });
  }
};

// Weekly Sales
exports.getWeeklySales = async (req, res) => {
  try {
    const start = moment().startOf('week');
    const end = moment().endOf('week');

    const payments = await Payment.find({
      paymentStatus: 'Paid',
      paymentDate: { $gte: start.toDate(), $lte: end.toDate() }
    });

    const total = payments.reduce((sum, p) => sum + p.amount, 0);

    res.status(200).json({ success: true, totalSales: total, count: payments.length, data: payments });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch weekly sales', error: err });
  }
};

// Monthly Sales
exports.getMonthlySales = async (req, res) => {
  try {
    const start = moment().startOf('month');
    const end = moment().endOf('month');

    const payments = await Payment.find({
      paymentStatus: 'Paid',
      paymentDate: { $gte: start.toDate(), $lte: end.toDate() }
    });

    const total = payments.reduce((sum, p) => sum + p.amount, 0);

    res.status(200).json({ success: true, totalSales: total, count: payments.length, data: payments });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch monthly sales', error: err });
  }
};
// Top Selling Products
exports.getTopSellingProducts = async (req, res) => {
  try {
    const orders = await Order.aggregate([
      { $unwind: "$products" },
      { $unwind: "$products.subCategories" },
      { $unwind: "$products.subCategories.parts" },
      {
        $group: {
          _id: {
            partId: "$products.subCategories.parts._id",
            partNumber: "$products.subCategories.parts.partNumber",
            partName: "$products.subCategories.parts.partName",
            brand: "$products.brand",
            model: "$products.model",
            year: "$products.year"
          },
          totalSold: { $sum: "$products.quantity" }
        }
      },
      { $sort: { totalSold: -1 } },
      { $limit: 10 },
      {
        $project: {
          _id: 0,
          partId: "$_id.partId",
          partNumber: "$_id.partNumber",
          partName: "$_id.partName",
          brand: "$_id.brand",
          model: "$_id.model",
          year: "$_id.year",
          totalSold: 1
        }
      }
    ]);

    res.status(200).json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch top selling products', error });
  }
};

// Low Selling Products
exports.getLowSellingProducts = async (req, res) => {
  try {
    const orders = await Order.aggregate([
      { $unwind: "$products" },
      { $unwind: "$products.subCategories" },
      { $unwind: "$products.subCategories.parts" },
      {
        $group: {
          _id: {
            partId: "$products.subCategories.parts._id",
            partNumber: "$products.subCategories.parts.partNumber",
            partName: "$products.subCategories.parts.partName",
            brand: "$products.brand",
            model: "$products.model",
            year: "$products.year"
          },
          totalSold: { $sum: "$products.quantity" }
        }
      },
      { $sort: { totalSold: 1 } },
      { $limit: 10 },
      {
        $project: {
          _id: 0,
          partId: "$_id.partId",
          partNumber: "$_id.partNumber",
          partName: "$_id.partName",
          brand: "$_id.brand",
          model: "$_id.model",
          year: "$_id.year",
          totalSold: 1
        }
      }
    ]);

    res.status(200).json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch low selling products', error });
  }
};

// Low Stock Parts
exports.getLowStockParts = async (req, res) => {
  try {
    const products = await Product.aggregate([
      { $unwind: "$subCategories" },
      { $unwind: "$subCategories.parts" },
      { $match: { "subCategories.parts.quantity": { $lt: 20 } } },
      {
        $project: {
          _id: "$subCategories.parts._id",
          partNumber: "$subCategories.parts.partNumber",
          partName: "$subCategories.parts.partName",
          quantity: "$subCategories.parts.quantity",
          brand: "$brand",
          model: "$model",
          year: "$year"
        }
      }
    ]);

    res.status(200).json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch low stock parts', error });
  }
};

// Out of Stock Parts
exports.getOutOfStockParts = async (req, res) => {
  try {
    const products = await Product.aggregate([
      { $unwind: "$subCategories" },
      { $unwind: "$subCategories.parts" },
      { $match: { "subCategories.parts.quantity": 0 } },
      {
        $project: {
          _id: "$subCategories.parts._id",
          partNumber: "$subCategories.parts.partNumber",
          partName: "$subCategories.parts.partName",
          quantity: "$subCategories.parts.quantity",
          brand: "$brand",
          model: "$model",
          year: "$year"
        }
      }
    ]);

    res.status(200).json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch out of stock parts', error });
  }
};
// Top Buyers
exports.getTopBuyers = async (req, res) => {
  try {
    const buyers = await Order.aggregate([
      { $match: { orderStatus: 'Delivered' } },
      {
        $group: {
          _id: "$userId",
          totalSpent: { $sum: { $toDouble: "$finalPayable" } },
          orderCount: { $sum: 1 }
        }
      },
      { $sort: { totalSpent: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "users",
          let: { userIdStr: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$_id", { $toObjectId: "$$userIdStr" }]
                }
              }
            }
          ],
          as: "userInfo"
        }
      },
      { $unwind: "$userInfo" },
      {
        $project: {
          userId: "$_id",
          totalSpent: 1,
          orderCount: 1,
          name: "$userInfo.name",
          email: "$userInfo.email",
          phone: "$userInfo.phone"
        }
      }
    ]);

    res.status(200).json({ success: true, data: buyers });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch top buyers', error });
  }
};
// Most Used Coupons
exports.getMostUsedCoupons = async (req, res) => {
  try {
    const mostUsedCoupons = await Order.aggregate([
      {
        $match: {
          couponCode: { $ne: null, $ne: '' }
        }
      },
      {
        $group: {
          _id: "$couponCode",
          usageCount: { $sum: 1 }
        }
      },
      {
        $sort: { usageCount: -1 }
      },
      {
        $limit: 10
      },
      {
        $lookup: {
          from: "coupons",
          localField: "_id",
          foreignField: "code",
          as: "couponInfo"
        }
      },
      { $unwind: "$couponInfo" },
      {
        $project: {
          code: "$_id",
          usageCount: 1,
          discountType: "$couponInfo.discountType",
          discountValue: "$couponInfo.discountValue",
          minOrderAmount: "$couponInfo.minOrderAmount",
          expiryDate: "$couponInfo.expiryDate",
          isActive: "$couponInfo.isActive",
          createdAt: "$couponInfo.createdAt"
        }
      }
    ]);

    res.status(200).json({ success: true, data: mostUsedCoupons });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch most used coupons', error });
  }
};

/////////////////////////////////////shop wise reports/////////////////////////////////////

// Shop Wise Sales for Single Shop
exports.getShopSalesById = async (req, res) => {
  try {
    const { shopId } = req.query;
    const result = await Order.aggregate([
      {
        $match: {
          orderStatus: 'Delivered',
          shopId: shopId
        }
      },
      {
        $group: {
          _id: "$shopId",
          totalOrders: { $sum: 1 },
          totalSales: { $sum: { $toDouble: "$finalPayable" } }
        }
      }
    ]);
    res.status(200).json({ success: true, data: result[0] || {} });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch shop sales", error });
  }
};

// Cancelled Orders for Shop
exports.getShopCancelledOrders = async (req, res) => {
  try {
    const { shopId } = req.query;
    const cancelledOrders = await Order.find({ orderStatus: 'Cancelled', shopId });

    const formatted = cancelledOrders.flatMap(order =>
      order.products.map(p => ({
        _id: order._id,
        userId: order.userId,
        orderStatus: order.orderStatus,
        partNumber: p.partNumber,
        partName: p.partName,
        totalAmount: order.totalAmount,
        finalPayable: order.finalPayable,
        productId: p.productId,
        quantity: p.quantity,
        name: order.deliveryAddress?.name,
        contact: order.deliveryAddress?.contact,
        address: order.deliveryAddress?.address,
        area: order.deliveryAddress?.area,
        brand: p.brand,
        year: p.year,
        model: p.model
      }))
    );

    res.status(200).json({ success: true, data: formatted });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch cancelled orders', error });
  }
};

// Returned Orders for Shop
exports.getShopReturnedOrders = async (req, res) => {
  try {
    const { shopId } = req.query;
    const returnedOrders = await Order.find({ orderStatus: 'Returned', shopId });

    const formatted = returnedOrders.flatMap(order =>
      order.products.map(p => ({
        _id: order._id,
        userId: order.userId,
        orderStatus: order.orderStatus,
        partNumber: p.partNumber,
        partName: p.partName,
        totalAmount: order.totalAmount,
        finalPayable: order.finalPayable,
        productId: p.productId,
        quantity: p.quantity,
        name: order.deliveryAddress?.name,
        contact: order.deliveryAddress?.contact,
        address: order.deliveryAddress?.address,
        area: order.deliveryAddress?.area,
        brand: p.brand,
        year: p.year,
        model: p.model
      }))
    );

    res.status(200).json({ success: true, data: formatted });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch returned orders', error });
  }
};

// Daily Sales for Shop
exports.getShopDailySales = async (req, res) => {
  try {
    const { shopId } = req.query;
    const start = moment().startOf('day');
    const end = moment().endOf('day');

    const payments = await Payment.find({
      paymentStatus: 'Paid',
      paymentDate: { $gte: start.toDate(), $lte: end.toDate() },
      shopId
    });

    const total = payments.reduce((sum, p) => sum + p.amount, 0);
    res.status(200).json({ success: true, totalSales: total, count: payments.length, data: payments });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch daily sales', error: err });
  }
};

// Weekly Sales for Shop
exports.getShopWeeklySales = async (req, res) => {
  try {
    const { shopId } = req.query;
    const start = moment().startOf('week');
    const end = moment().endOf('week');

    const payments = await Payment.find({
      paymentStatus: 'Paid',
      paymentDate: { $gte: start.toDate(), $lte: end.toDate() },
      shopId
    });

    const total = payments.reduce((sum, p) => sum + p.amount, 0);
    res.status(200).json({ success: true, totalSales: total, count: payments.length, data: payments });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch weekly sales', error: err });
  }
};

// Monthly Sales for Shop
exports.getShopMonthlySales = async (req, res) => {
  try {
    const { shopId } = req.query;
    const start = moment().startOf('month');
    const end = moment().endOf('month');

    const payments = await Payment.find({
      paymentStatus: 'Paid',
      paymentDate: { $gte: start.toDate(), $lte: end.toDate() },
      shopId
    });

    const total = payments.reduce((sum, p) => sum + p.amount, 0);
    res.status(200).json({ success: true, totalSales: total, count: payments.length, data: payments });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch monthly sales', error: err });
  }
};

// Top Selling Products for Shop
exports.getShopTopSellingProducts = async (req, res) => {
  try {
    const { shopId } = req.query;
    const orders = await Order.aggregate([
      { $match: { shopId, orderStatus: 'Delivered' } },
      { $unwind: "$products" },
      { $unwind: "$products.subCategories" },
      { $unwind: "$products.subCategories.parts" },
      {
        $group: {
          _id: {
            partId: "$products.subCategories.parts._id",
            partNumber: "$products.subCategories.parts.partNumber",
            partName: "$products.subCategories.parts.partName",
            brand: "$products.brand",
            model: "$products.model",
            year: "$products.year"
          },
          totalSold: { $sum: "$products.quantity" }
        }
      },
      { $sort: { totalSold: -1 } },
      { $limit: 10 },
      {
        $project: {
          _id: 0,
          partId: "$_id.partId",
          partNumber: "$_id.partNumber",
          partName: "$_id.partName",
          brand: "$_id.brand",
          model: "$_id.model",
          year: "$_id.year",
          totalSold: 1
        }
      }
    ]);
    res.status(200).json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch top selling products for shop', error });
  }
};

// Low Selling Products for Shop
exports.getShopLowSellingProducts = async (req, res) => {
  try {
    const { shopId } = req.query;
    const orders = await Order.aggregate([
      { $match: { shopId, orderStatus: 'Delivered' } },
      { $unwind: "$products" },
      { $unwind: "$products.subCategories" },
      { $unwind: "$products.subCategories.parts" },
      {
        $group: {
          _id: {
            partId: "$products.subCategories.parts._id",
            partNumber: "$products.subCategories.parts.partNumber",
            partName: "$products.subCategories.parts.partName",
            brand: "$products.brand",
            model: "$products.model",
            year: "$products.year"
          },
          totalSold: { $sum: "$products.quantity" }
        }
      },
      { $sort: { totalSold: 1 } },
      { $limit: 10 },
      {
        $project: {
          _id: 0,
          partId: "$_id.partId",
          partNumber: "$_id.partNumber",
          partName: "$_id.partName",
          brand: "$_id.brand",
          model: "$_id.model",
          year: "$_id.year",
          totalSold: 1
        }
      }
    ]);
    res.status(200).json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch low selling products for shop', error });
  }
};

// Low Stock Parts for Shop
exports.getShopLowStockParts = async (req, res) => {
  try {
    const { shopId } = req.query;
    const products = await Product.aggregate([
      { $match: { shopId: shopId } },
      { $unwind: "$subCategories" },
      { $unwind: "$subCategories.parts" },
      { $match: { "subCategories.parts.quantity": { $lt: 20 } } },
      {
        $project: {
          _id: "$subCategories.parts._id",
          partNumber: "$subCategories.parts.partNumber",
          partName: "$subCategories.parts.partName",
          quantity: "$subCategories.parts.quantity",
          brand: "$brand",
          model: "$model",
          year: "$year"
        }
      }
    ]);
    res.status(200).json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch low stock parts for shop', error });
  }
};

// Out of Stock Parts for Shop
exports.getShopOutOfStockParts = async (req, res) => {
  try {
    const { shopId } = req.query;
    const products = await Product.aggregate([
      { $match: { shopId: shopId } },
      { $unwind: "$subCategories" },
      { $unwind: "$subCategories.parts" },
      { $match: { "subCategories.parts.quantity": 0 } },
      {
        $project: {
          _id: "$subCategories.parts._id",
          partNumber: "$subCategories.parts.partNumber",
          partName: "$subCategories.parts.partName",
          quantity: "$subCategories.parts.quantity",
          brand: "$brand",
          model: "$model",
          year: "$year"
        }
      }
    ]);
    res.status(200).json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch out of stock parts for shop', error });
  }
};

exports.getShopPendingOrders = async (req, res) => {
  try {
    const { shopId } = req.query;
    const pendingOrders = await Order.find({ orderStatus: 'Pending', shopId });

    const formatted = pendingOrders.flatMap(order =>
      order.products.map(p => ({
        _id: order._id,
        userId: order.userId,
        orderStatus: order.orderStatus,
        partNumber: p.partNumber,
        partName: p.partName,
        totalAmount: order.totalAmount,
        finalPayable: order.finalPayable,
        productId: p.productId,
        quantity: p.quantity,
        name: order.deliveryAddress?.name,
        contact: order.deliveryAddress?.contact,
        address: order.deliveryAddress?.address,
        area: order.deliveryAddress?.area,
        brand: p.brand,
        year: p.year,
        model: p.model
      }))
    );

    res.status(200).json({ success: true, data: formatted });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch pending orders', error });
  }
};