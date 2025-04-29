const Order = require('../models/Order');
const Payment = require('../models/Payment');

exports.requestRefund = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        message: 'Reason is required',
        success: false,
        data: []
      });
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        message: 'Order not found',
        success: false,
        data: []
      });
    }

    order.refundRequest = {
      requested: true,
      reason: reason,
      status: 'Pending'
    };
    order.orderStatus = 'Refund Requested';
    await order.save();

    return res.status(200).json({
      message: 'Refund requested successfully',
      success: true,
      data: order
    });

  } catch (error) {
    console.error('Request Refund Error:', error);
    res.status(500).json({
      message: 'Failed to request refund',
      success: false,
      data: error.message
    });
  }
};



exports.approveRefund = async (req, res) => {
  try {
    const orderId = req.params.orderId;

    const order = await Order.findById(orderId);

    if (!order || !order.refundRequest.requested) {
      return res.status(404).json({
        message: 'Refund request not found for this order',
        success: false,
        data: []
      });
    }

    // Find related payment
    const payment = await Payment.findOne({ orderId });

    if (!payment) {
      return res.status(404).json({
        message: 'Payment record not found for refund',
        success: false,
        data: []
      });
    }

    // Update payment
    payment.paymentStatus = 'Refunded';
    await payment.save();

    // Update order
    order.orderStatus = 'Refunded';
    order.refundRequest.status = 'Approved';
    await order.save();

    return res.status(200).json({
      message: 'Refund approved and updated successfully',
      success: true,
      data: { order, payment }
    });

  } catch (error) {
    console.error('Approve Refund Error:', error);
    res.status(500).json({
      message: 'Failed to approve refund',
      success: false,
      data: error.message
    });
  }
};