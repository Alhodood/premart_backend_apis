// controllers/paymentController.js
const Payment = require('../models/Payment');
const Order = require('../models/Order');
const MasterOrder = require('../models/MasterOrder');
const { v4: uuidv4 } = require('uuid');


exports.createPayment = async (req, res) => {
  try {
    const { masterOrderId, userId, amount, paymentMethod, paymentStatus, transactionId } = req.body;

    if (!masterOrderId || !userId || !amount || !paymentMethod || !paymentStatus) {
      return res.status(400).json({
        message: 'Required fields missing: masterOrderId, userId, amount, paymentMethod, paymentStatus',
        success: false,
        data: []
      });
    }

    console.log(`💳 Processing payment for master order: ${masterOrderId}`);

    // ✅ 1. Get master order
    const masterOrder = await MasterOrder.findById(masterOrderId);
    
    if (!masterOrder) {
      return res.status(404).json({
        message: 'Master order not found',
        success: false,
        data: []
      });
    }

    if (!masterOrder.orderIds || masterOrder.orderIds.length === 0) {
      return res.status(400).json({
        message: 'No orders found in master order',
        success: false,
        data: []
      });
    }

    console.log(`📦 Found ${masterOrder.orderIds.length} orders in master order`);

    // ✅ 2. Fetch first order
    const firstOrder = await Order.findById(masterOrder.orderIds[0]);
    
    if (!firstOrder) {
      return res.status(404).json({
        message: 'Order not found',
        success: false,
        data: []
      });
    }

    // ✅ 3. Extract delivery address safely
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

    // ✅ 4. Extract coupon info safely - FIXED NULL HANDLING
    let couponCode = null;
    let couponDetails = null;

    // Helper function to safely convert to plain object
    const toPlainObject = (obj) => {
      if (!obj) return null;
      return obj.toObject ? obj.toObject() : obj;
    };

    // Check order coupon first
    if (firstOrder.coupon) {
      const orderCoupon = toPlainObject(firstOrder.coupon);
      
      // ✅ FIX: Check if orderCoupon is not null AND has a code
      if (orderCoupon && orderCoupon.code) {
        couponCode = orderCoupon.code;
        couponDetails = {
          code: orderCoupon.code,
          discountType: orderCoupon.discountType || null,
          discountValue: orderCoupon.discountValue || null,
          discountAmount: orderCoupon.discountAmount || null
        };
        console.log(`🎟️ Found coupon in order: ${couponCode}`);
      }
    }
    
    // Fallback to master order coupon only if we don't have one yet
    if (!couponDetails && masterOrder.couponApplied) {
      const masterCoupon = toPlainObject(masterOrder.couponApplied);
      
      // ✅ FIX: Check if masterCoupon is not null AND has a code
      if (masterCoupon && masterCoupon.code) {
        couponCode = masterCoupon.code;
        couponDetails = {
          code: masterCoupon.code,
          discountType: masterCoupon.discountType || null,
          discountValue: masterCoupon.discountValue || null,
          discountAmount: masterCoupon.discountAmount || null
        };
        console.log(`🎟️ Found coupon in master order: ${couponCode}`);
      }
    }

    if (!couponCode) {
      console.log(`🎟️ No coupon applied to this order`);
    }

    console.log(`📍 Delivery Address: ${deliveryAddress?.address || 'N/A'}, ${deliveryAddress?.place || 'N/A'}`);

    // ✅ 5. Auto-generate transaction ID if not provided
    let finalTransactionId = transactionId;
    
    if (!finalTransactionId || finalTransactionId === null || finalTransactionId === 'null') {
      const timestamp = Date.now();
      const randomStr = uuidv4().split('-')[0].toUpperCase();
      
      switch(paymentMethod.toUpperCase()) {
        case 'COD':
          finalTransactionId = `COD_${timestamp}_${randomStr}`;
          break;
        case 'CARD':
          finalTransactionId = `CARD_${timestamp}_${randomStr}`;
          break;
        case 'WALLET':
          finalTransactionId = `WALLET_${timestamp}_${randomStr}`;
          break;
        case 'UPI':
          finalTransactionId = `UPI_${timestamp}_${randomStr}`;
          break;
        default:
          finalTransactionId = `TXN_${timestamp}_${randomStr}`;
      }
      
      console.log(`✅ Auto-generated transaction ID: ${finalTransactionId}`);
    }

    // ✅ 6. Create payment record - Only include non-null fields
    const paymentData = {
      orderId: masterOrderId,
      userId,
      shopId: null,
      amount,
      paymentMethod: paymentMethod.toUpperCase(),
      transactionId: finalTransactionId,
      paymentStatus,
    };

    // Only add optional fields if they have values
    if (deliveryAddress) {
      paymentData.deliveryAddress = deliveryAddress;
    }

    if (couponCode) {
      paymentData.couponCode = couponCode;
    }

    if (couponDetails) {
      paymentData.couponDetails = couponDetails;
    }

    const payment = new Payment(paymentData);
    await payment.save();
    
    console.log(`✅ Payment created: ${payment._id}`);
    console.log(`   Transaction ID: ${payment.transactionId}`);
    console.log(`   Amount: ${payment.amount}`);
    console.log(`   Method: ${payment.paymentMethod}`);

    // ✅ 7. Get all orders from master order
    const orders = await Order.find({
      _id: { $in: masterOrder.orderIds }
    });

    console.log(`📦 Found ${orders.length} orders to process for delivery assignment`);

    // ✅ 8. Get available delivery boys
    const DeliveryBoy = require('../models/DeliveryBoy');
    const availableDeliveryBoys = await DeliveryBoy.find({ 
      availability: true,
    });

    console.log(`👷 Available delivery boys: ${availableDeliveryBoys.length}`);

    if (availableDeliveryBoys.length === 0) {
      return res.status(200).json({
        message: 'Payment recorded but no available delivery boys at the moment',
        success: true,
        data: {
          payment: {
            _id: payment._id,
            transactionId: payment.transactionId,
            amount: payment.amount,
            paymentMethod: payment.paymentMethod,
            paymentStatus: payment.paymentStatus,
            deliveryAddress: payment.deliveryAddress || null,
            couponCode: payment.couponCode || null,
            couponDetails: payment.couponDetails || null,
          },
          ordersProcessed: 0,
          ordersPending: orders.length
        }
      });
    }

    // ✅ 9. Auto-assign delivery boys to all orders
    const { autoAssignDeliveryBoyWithin5kmHelper } = require('../helper/autoAssignHelper');
    
    const assignmentResults = [];

    for (const order of orders) {
      try {
        console.log(`\n🔄 Processing order ${order._id}...`);
        
        // Skip if already assigned
        if (order.assignedDeliveryBoy) {
          console.log(`⚠️ Order ${order._id} already assigned, skipping`);
          assignmentResults.push({
            orderId: order._id,
            status: 'already_assigned',
            message: 'Order already has a delivery boy'
          });
          continue;
        }

        // Call auto-assign helper
        const result = await autoAssignDeliveryBoyWithin5kmHelper(order._id);
        
        assignmentResults.push({
          orderId: order._id,
          status: result.success ? 'assigned' : 'failed',
          message: result.message,
          deliveryBoysNotified: result.data?.nearbyDeliveryBoys?.length || 0
        });

        // Small delay to prevent race conditions
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (assignError) {
        console.error(`❌ Failed to assign order ${order._id}:`, assignError.message);
        
        assignmentResults.push({
          orderId: order._id,
          status: 'error',
          message: assignError.message
        });
      }
    }

    // ✅ 10. Calculate summary
    const successCount = assignmentResults.filter(r => r.status === 'assigned').length;
    const failedCount = assignmentResults.filter(r => r.status === 'failed' || r.status === 'error').length;
    const alreadyAssignedCount = assignmentResults.filter(r => r.status === 'already_assigned').length;

    console.log(`\n📊 Assignment Summary:`);
    console.log(`   ✅ Successfully assigned: ${successCount}`);
    console.log(`   ❌ Failed: ${failedCount}`);
    console.log(`   ⚠️ Already assigned: ${alreadyAssignedCount}`);

    return res.status(201).json({
      message: 'Payment recorded and orders assignment initiated',
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
        },
        masterOrderId: masterOrder._id,
        totalOrders: orders.length,
        summary: {
          successfullyAssigned: successCount,
          failed: failedCount,
          alreadyAssigned: alreadyAssignedCount
        },
        assignmentResults
      }
    });

  } catch (error) {
    console.error('❌ Create Payment Error:', error);
    console.error('Stack trace:', error.stack);
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
    const payments = await Payment.find()
      .populate({
        path: 'userId',
        select: 'name address'
      })
      .populate({
        path: 'shopId',
        select: 'shopeDetails.shopName shopeDetails.shopAddress'
      })
      .populate({
        path: 'orderId',
        select: 'orderNumber'
      });

    // Flatten + enforce correct latest-first sorting
    const flatData = payments
      .map(p => ({
        paymentId: p._id,

        // MAIN DISPLAY
        userName: p.userId?.name || null,
        shopName: p.shopId?.shopeDetails?.shopName || null,
        orderId: p.orderId?._id || null,

        amount: p.amount,
        paymentMethod: p.paymentMethod,
        paymentStatus: p.paymentStatus,
        transactionId: p.transactionId || null,

        paymentDate: p.paymentDate || null,
        createdAt: p.createdAt || null,

        // EXTRA FIELDS
        userContact: p.userId?.address?.[0]?.contact || null,
        shopAddress: p.shopId?.shopeDetails?.shopAddress || null,

        // INTERNAL SORT FIELD (not sent to frontend)
        __sortDate: new Date(p.paymentDate || p.createdAt || 0)
      }))
      // GUARANTEED latest first
      .sort((a, b) => b.__sortDate - a.__sortDate)
      // remove internal field
      .map(({ __sortDate, ...rest }) => rest);

    return res.status(200).json({
      success: true,
      message: 'All payments fetched successfully',
      data: flatData
    });

  } catch (error) {
    console.error('Fetch All Payments Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payments',
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