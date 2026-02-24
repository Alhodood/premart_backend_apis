const Payment = require('../models/Payment');
const Order = require('../models/Order');
const MasterOrder = require('../models/MasterOrder');
const { v4: uuidv4 } = require('uuid');
const { notifyPayment } = require('./bellNotifications');
const logger = require('../config/logger');

exports.createPayment = async (req, res) => {
  try {
    const { masterOrderId, userId, amount, paymentMethod, paymentStatus, transactionId } = req.body;
    if (!masterOrderId || !userId || !amount || !paymentMethod || !paymentStatus) {
      return res.status(400).json({ message: 'Required fields missing: masterOrderId, userId, amount, paymentMethod, paymentStatus', success: false, data: [] });
    }

    const masterOrder = await MasterOrder.findById(masterOrderId);
    if (!masterOrder) return res.status(404).json({ message: 'Master order not found', success: false, data: [] });
    if (!masterOrder.orderIds || masterOrder.orderIds.length === 0) return res.status(400).json({ message: 'No orders found in master order', success: false, data: [] });

    const firstOrder = await Order.findById(masterOrder.orderIds[0]);
    if (!firstOrder) return res.status(404).json({ message: 'Order not found', success: false, data: [] });

    let deliveryAddress = null;
    if (firstOrder.deliveryAddress) {
      deliveryAddress = {
        name: firstOrder.deliveryAddress.name || 'N/A',
        contact: firstOrder.deliveryAddress.contact || 'N/A',
        address: firstOrder.deliveryAddress.address || 'N/A',
        area: firstOrder.deliveryAddress.area || 'N/A',
        place: firstOrder.deliveryAddress.place || 'N/A',
        latitude: firstOrder.deliveryAddress.latitude || null,
        longitude: firstOrder.deliveryAddress.longitude || null,
        addressType: firstOrder.deliveryAddress.addressType || 'Home'
      };
    }

    const toPlainObject = (obj) => { if (!obj) return null; return obj.toObject ? obj.toObject() : obj; };
    let couponCode = null, couponDetails = null;
    if (firstOrder.coupon) {
      const orderCoupon = toPlainObject(firstOrder.coupon);
      if (orderCoupon && orderCoupon.code) {
        couponCode = orderCoupon.code;
        couponDetails = {
          code: orderCoupon.code,
          discountType: orderCoupon.discountType || null,
          discountValue: orderCoupon.discountValue || null,
          discountAmount: orderCoupon.discountAmount || null
        };
      }
    }
    if (!couponDetails && masterOrder.couponApplied) {
      const masterCoupon = toPlainObject(masterOrder.couponApplied);
      if (masterCoupon && masterCoupon.code) {
        couponCode = masterCoupon.code;
        couponDetails = {
          code: masterCoupon.code,
          discountType: masterCoupon.discountType || null,
          discountValue: masterCoupon.discountValue || null,
          discountAmount: masterCoupon.discountAmount || null
        };
      }
    }

    let finalTransactionId = transactionId;
    if (!finalTransactionId || finalTransactionId === null || finalTransactionId === 'null') {
      const timestamp = Date.now();
      const randomStr = uuidv4().split('-')[0].toUpperCase();
      switch (paymentMethod.toUpperCase()) {
        case 'COD':    finalTransactionId = `COD_${timestamp}_${randomStr}`; break;
        case 'CARD':   finalTransactionId = `CARD_${timestamp}_${randomStr}`; break;
        case 'WALLET': finalTransactionId = `WALLET_${timestamp}_${randomStr}`; break;
        case 'UPI':    finalTransactionId = `UPI_${timestamp}_${randomStr}`; break;
        default:       finalTransactionId = `TXN_${timestamp}_${randomStr}`;
      }
    }

    const paymentData = {
      orderId: masterOrderId,
      userId,
      shopId: null,
      amount,
      paymentMethod: paymentMethod.toUpperCase(),
      transactionId: finalTransactionId,
      paymentStatus
    };
    if (deliveryAddress) paymentData.deliveryAddress = deliveryAddress;
    if (couponCode) paymentData.couponCode = couponCode;
    if (couponDetails) paymentData.couponDetails = couponDetails;

    const payment = new Payment(paymentData);
    await payment.save();

    try {
      const orderForNotif = await Order.findById(masterOrder.orderIds[0]);
      if (orderForNotif) await notifyPayment(payment, orderForNotif);
    } catch (notifErr) {
      logger.warn('Payment notification failed', { paymentId: payment._id, error: notifErr.message });
    }

    // ✅ Auto-assign already runs in createOrder (fire-and-forget) — no assignment needed here
    return res.status(201).json({
      message: 'Payment recorded successfully',
      success: true,
      data: {
        payment: {
          _id: payment._id,
          masterOrderId: payment.orderId,
          userId: payment.userId,
          amount: payment.amount,
          paymentMethod: payment.paymentMethod,
          paymentStatus: payment.paymentStatus,
          transactionId: payment.transactionId,
          deliveryAddress: payment.deliveryAddress || null,
          couponCode: payment.couponCode || null,
          couponDetails: payment.couponDetails || null,
          createdAt: payment.createdAt
        }
      }
    });

  } catch (error) {
    logger.error('createPayment failed', { masterOrderId: req.body.masterOrderId, userId: req.body.userId, error: error.message, stack: error.stack });
    res.status(500).json({ message: 'Failed to record payment', success: false, data: error.message });
  }
};

exports.updatePaymentStatus = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { paymentStatus } = req.body;
    if (!paymentId || !paymentStatus) return res.status(400).json({ message: 'PaymentId and paymentStatus are required', success: false, data: [] });

    const payment = await Payment.findById(paymentId);
    if (!payment) return res.status(404).json({ message: 'Payment not found', success: false, data: [] });

    payment.paymentStatus = paymentStatus;
    await payment.save();

    if (paymentStatus === 'Paid') await Order.findByIdAndUpdate(payment.orderId, { paymentStatus: 'Paid', orderStatus: 'Confirmed' });
    else if (paymentStatus === 'Failed') await Order.findByIdAndUpdate(payment.orderId, { paymentStatus: 'Failed', orderStatus: 'Payment Failed' });
    else if (paymentStatus === 'Refunded') await Order.findByIdAndUpdate(payment.orderId, { paymentStatus: 'Refunded', orderStatus: 'Refunded' });

    return res.status(200).json({ message: 'Payment status and linked order updated successfully', success: true, data: payment });
  } catch (error) {
    logger.error('updatePaymentStatus failed', { paymentId: req.params.paymentId, error: error.message, stack: error.stack });
    res.status(500).json({ message: 'Failed to update payment status', success: false, data: error.message });
  }
};

exports.getAllPayments = async (req, res) => {
  try {
    const payments = await Payment.find()
      .populate({ path: 'userId', select: 'name address' })
      .populate({ path: 'shopId', select: 'shopeDetails.shopName shopeDetails.shopAddress' })
      .populate({ path: 'orderId', select: 'orderNumber' });
    const flatData = payments.map(p => ({
      paymentId: p._id,
      userName: p.userId?.name || null,
      shopName: p.shopId?.shopeDetails?.shopName || null,
      orderId: p.orderId?._id || null,
      amount: p.amount,
      paymentMethod: p.paymentMethod,
      paymentStatus: p.paymentStatus,
      transactionId: p.transactionId || null,
      paymentDate: p.paymentDate || null,
      createdAt: p.createdAt || null,
      userContact: p.userId?.address?.[0]?.contact || null,
      shopAddress: p.shopId?.shopeDetails?.shopAddress || null,
      __sortDate: new Date(p.paymentDate || p.createdAt || 0)
    }))
      .sort((a, b) => b.__sortDate - a.__sortDate)
      .map(({ __sortDate, ...rest }) => rest);
    return res.status(200).json({ success: true, message: 'All payments fetched successfully', data: flatData });
  } catch (error) {
    logger.error('getAllPayments failed', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: 'Failed to fetch payments', data: error.message });
  }
};

exports.getShopPayments = async (req, res) => {
  try {
    const shopId = req.params.shopId;
    const payments = await Payment.find({ shopId }).sort({ createdAt: -1 });
    return res.status(200).json({ message: 'Shop payments fetched successfully', success: true, data: payments });
  } catch (error) {
    logger.error('getShopPayments failed', { shopId: req.params.shopId, error: error.message, stack: error.stack });
    res.status(500).json({ message: 'Failed to fetch shop payments', success: false, data: error.message });
  }
};

exports.getUserPayments = async (req, res) => {
  try {
    const userId = req.params.userId;
    const payments = await Payment.find({ userId }).sort({ createdAt: -1 });
    return res.status(200).json({ message: 'User payment history fetched successfully', success: true, data: payments });
  } catch (error) {
    logger.error('getUserPayments failed', { userId: req.params.userId, error: error.message, stack: error.stack });
    res.status(500).json({ message: 'Failed to fetch user payments', success: false, data: error.message });
  }
};

exports.paymentSummary = async (req, res) => {
  try {
    const payments = await Payment.find();
    const totalPaid = payments.filter(p => p.paymentStatus === 'Paid').reduce((sum, p) => sum + p.amount, 0);
    const totalFailed = payments.filter(p => p.paymentStatus === 'Failed').reduce((sum, p) => sum + p.amount, 0);
    const totalRefunded = payments.filter(p => p.paymentStatus === 'Refunded').reduce((sum, p) => sum + p.amount, 0);
    return res.status(200).json({
      message: 'Payment summary',
      success: true,
      data: {
        totalTransactions: payments.length,
        totalPaid: totalPaid.toFixed(2),
        totalFailed: totalFailed.toFixed(2),
        totalRefunded: totalRefunded.toFixed(2)
      }
    });
  } catch (error) {
    logger.error('paymentSummary failed', { error: error.message, stack: error.stack });
    res.status(500).json({ message: 'Failed to fetch payment summary', success: false, data: error.message });
  }
};

exports.searchPaymentsSuperAdmin = async (req, res) => {
  try {
    const { transactionId, userId, orderId, paymentMethod, paymentStatus, from, to, minAmount, maxAmount, page = 1, limit = 10, sort = 'desc' } = req.query;
    let filter = {};
    if (transactionId) filter.transactionId = { $regex: transactionId, $options: 'i' };
    if (userId) filter.userId = userId;
    if (orderId) filter.orderId = orderId;
    if (paymentMethod) filter.paymentMethod = paymentMethod;
    if (paymentStatus) filter.paymentStatus = paymentStatus;
    if (from && to) filter.createdAt = { $gte: new Date(from), $lte: new Date(to) };
    if (minAmount && maxAmount) filter.amount = { $gte: parseFloat(minAmount), $lte: parseFloat(maxAmount) };
    else if (minAmount) filter.amount = { $gte: parseFloat(minAmount) };
    else if (maxAmount) filter.amount = { $lte: parseFloat(maxAmount) };

    const payments = await Payment.find(filter)
      .sort({ createdAt: sort === 'asc' ? 1 : -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    const total = await Payment.countDocuments(filter);
    return res.status(200).json({ message: 'Payments fetched successfully', success: true, total, page: parseInt(page), limit: parseInt(limit), data: payments });
  } catch (error) {
    logger.error('searchPaymentsSuperAdmin failed', { error: error.message, stack: error.stack });
    res.status(500).json({ message: 'Failed to search payments', success: false, data: error.message });
  }
};

exports.searchPaymentsShopAdmin = async (req, res) => {
  try {
    const shopId = req.params.shopId;
    const { transactionId, userId, orderId, paymentMethod, paymentStatus, from, to, minAmount, maxAmount, page = 1, limit = 10, sort = 'desc' } = req.query;
    if (!shopId) return res.status(400).json({ message: 'Shop ID is required', success: false, data: [] });

    let filter = { shopId };
    if (transactionId) filter.transactionId = { $regex: transactionId, $options: 'i' };
    if (userId) filter.userId = userId;
    if (orderId) filter.orderId = orderId;
    if (paymentMethod) filter.paymentMethod = paymentMethod;
    if (paymentStatus) filter.paymentStatus = paymentStatus;
    if (from && to) filter.createdAt = { $gte: new Date(from), $lte: new Date(to) };
    if (minAmount && maxAmount) filter.amount = { $gte: parseFloat(minAmount), $lte: parseFloat(maxAmount) };
    else if (minAmount) filter.amount = { $gte: parseFloat(minAmount) };
    else if (maxAmount) filter.amount = { $lte: parseFloat(maxAmount) };

    const payments = await Payment.find(filter)
      .sort({ createdAt: sort === 'asc' ? 1 : -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    const total = await Payment.countDocuments(filter);
    return res.status(200).json({ message: 'Shop Payments fetched successfully', success: true, total, page: parseInt(page), limit: parseInt(limit), data: payments });
  } catch (error) {
    logger.error('searchPaymentsShopAdmin failed', { shopId: req.params.shopId, error: error.message, stack: error.stack });
    res.status(500).json({ message: 'Failed to search shop payments', success: false, data: error.message });
  }
};