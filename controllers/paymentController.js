const Payment = require('../models/Payment');
const Order = require('../models/Order');

exports.createPayment = async (req, res) => {
  try {
    const { orderId, userId, shopId, amount, paymentMethod, transactionId, paymentStatus } = req.body;

    if (!orderId || !userId || !amount || !paymentMethod || !paymentStatus) {
      return res.status(400).json({
        message: 'Required fields missing',
        success: false,
        data: []
      });
    }

    const payment = new Payment({
      orderId,
      userId,
      shopId,
      amount,
      paymentMethod,
      transactionId,
      paymentStatus: paymentStatus
    });

    await payment.save();

    // Auto-assign delivery boy within 5km after payment is saved
    try {
      const { autoAssignDeliveryBoyWithin5kmHelper } = require('../helper/autoAssignHelper');
      await autoAssignDeliveryBoyWithin5kmHelper(orderId);
    } catch (err) {
      console.error('Auto assign delivery boy failed:', err.message);
    }

    return res.status(201).json({
      message: 'Payment recorded successfully',
      success: true,
      data: payment
    });

  } catch (error) {
    console.error('Create Payment Error:', error);
    res.status(500).json({
      message: 'Failed to record payment',
      success: false,
      data: error.message
    });
  }
};




exports.updatePaymentStatus = async (req, res) => {
  try {
    const paymentId = req.params.paymentId;
    const { paymentStatus } = req.body;

    if (!paymentId || !paymentStatus) {
      return res.status(400).json({
        message: 'PaymentId and paymentStatus are required',
        success: false,
        data: []
      });
    }

    const payment = await Payment.findById(paymentId);

    if (!payment) {
      return res.status(404).json({
        message: 'Payment not found',
        success: false,
        data: []
      });
    }

    // Update payment record
    payment.paymentStatus = paymentStatus;
    await payment.save();

    // Auto Update Related Order based on payment
    if (paymentStatus === 'Paid') {
      await Order.findByIdAndUpdate(payment.orderId, { paymentStatus: 'Paid', orderStatus: 'Confirmed' });
    } else if (paymentStatus === 'Failed') {
      await Order.findByIdAndUpdate(payment.orderId, { paymentStatus: 'Failed', orderStatus: 'Payment Failed' });
    } else if (paymentStatus === 'Refunded') {
      await Order.findByIdAndUpdate(payment.orderId, { paymentStatus: 'Refunded', orderStatus: 'Refunded' });
    }

    return res.status(200).json({
      message: 'Payment status and linked order updated successfully',
      success: true,
      data: payment
    });

  } catch (error) {
    console.error('Update Payment Status Error:', error);
    res.status(500).json({
      message: 'Failed to update payment status',
      success: false,
      data: error.message
    });
  }
};


exports.getAllPayments = async (req, res) => {
    try {
      const payments = await Payment.find().sort({ createdAt: -1 });
  
      return res.status(200).json({
        message: 'All payments fetched successfully',
        success: true,
        data: payments
      });
    } catch (error) {
      console.error('Fetch All Payments Error:', error);
      res.status(500).json({
        message: 'Failed to fetch payments',
        success: false,
        data: error.message
      });
    }
  };



  exports.getShopPayments = async (req, res) => {
    try {
      const shopId = req.params.shopId;
  
      const payments = await Payment.find({ shopId }).sort({ createdAt: -1 });
  
      return res.status(200).json({
        message: 'Shop payments fetched successfully',
        success: true,
        data: payments
      });
    } catch (error) {
      console.error('Fetch Shop Payments Error:', error);
      res.status(500).json({
        message: 'Failed to fetch shop payments',
        success: false,
        data: error.message
      });
    }
  };


  exports.getUserPayments = async (req, res) => {
    try {
      const userId = req.params.userId;
  
      const payments = await Payment.find({ userId }).sort({ createdAt: -1 });
  
      return res.status(200).json({
        message: 'User payment history fetched successfully',
        success: true,
        data: payments
      });
    } catch (error) {
      console.error('Fetch User Payments Error:', error);
      res.status(500).json({
        message: 'Failed to fetch user payments',
        success: false,
        data: error.message
      });
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
      console.error('Payment Summary Error:', error);
      res.status(500).json({
        message: 'Failed to fetch payment summary',
        success: false,
        data: error.message
      });
    }
  };

  exports.searchPaymentsSuperAdmin = async (req, res) => {
    try {
      const { 
        transactionId, userId, orderId, paymentMethod, 
        paymentStatus, from, to, 
        minAmount, maxAmount, // <-- added
        page = 1, limit = 10, sort = 'desc' 
      } = req.query;
  
      let filter = {};
  
      if (transactionId) filter.transactionId = { $regex: transactionId, $options: 'i' };
      if (userId) filter.userId = userId;
      if (orderId) filter.orderId = orderId;
      if (paymentMethod) filter.paymentMethod = paymentMethod;
      if (paymentStatus) filter.paymentStatus = paymentStatus;
  
      if (from && to) {
        filter.createdAt = {
          $gte: new Date(from),
          $lte: new Date(to)
        };
      }
  
      if (minAmount && maxAmount) {
        filter.amount = { $gte: parseFloat(minAmount), $lte: parseFloat(maxAmount) };
      } else if (minAmount) {
        filter.amount = { $gte: parseFloat(minAmount) };
      } else if (maxAmount) {
        filter.amount = { $lte: parseFloat(maxAmount) };
      }
  
      const payments = await Payment.find(filter)
        .sort({ createdAt: sort === 'asc' ? 1 : -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit));
  
      const total = await Payment.countDocuments(filter);
  
      return res.status(200).json({
        message: 'Payments fetched successfully',
        success: true,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        data: payments
      });
  
    } catch (error) {
      console.error('Search Payments SuperAdmin Error:', error);
      res.status(500).json({
        message: 'Failed to search payments',
        success: false,
        data: error.message
      });
    }
  };


  exports.searchPaymentsShopAdmin = async (req, res) => {
    try {
      const shopId = req.params.shopId;
  
      const { 
        transactionId, userId, orderId, paymentMethod, 
        paymentStatus, from, to, 
        minAmount, maxAmount,
        page = 1, limit = 10, sort = 'desc' 
      } = req.query;
  
      if (!shopId) {
        return res.status(400).json({
          message: 'Shop ID is required',
          success: false,
          data: []
        });
      }
  
      let filter = { shopId };
  
      if (transactionId) filter.transactionId = { $regex: transactionId, $options: 'i' };
      if (userId) filter.userId = userId;
      if (orderId) filter.orderId = orderId;
      if (paymentMethod) filter.paymentMethod = paymentMethod;
      if (paymentStatus) filter.paymentStatus = paymentStatus;
  
      if (from && to) {
        filter.createdAt = {
          $gte: new Date(from),
          $lte: new Date(to)
        };
      }

      if (minAmount && maxAmount) {
        filter.amount = { $gte: parseFloat(minAmount), $lte: parseFloat(maxAmount) };
      } else if (minAmount) {
        filter.amount = { $gte: parseFloat(minAmount) };
      } else if (maxAmount) {
        filter.amount = { $lte: parseFloat(maxAmount) };
      }
  
      const payments = await Payment.find(filter)
        .sort({ createdAt: sort === 'asc' ? 1 : -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit));
  
      const total = await Payment.countDocuments(filter);
  
      return res.status(200).json({
        message: 'Shop Payments fetched successfully',
        success: true,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        data: payments
      });
  
    } catch (error) {
      console.error('Search Payments ShopAdmin Error:', error);
      res.status(500).json({
        message: 'Failed to search shop payments',
        success: false,
        data: error.message
      });
    }
  };