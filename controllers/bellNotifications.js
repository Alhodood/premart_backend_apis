// controllers/notificationController.js
const SuperNotification = require('../models/superNotification');
const { sendOrderStatusEmail } = require('../services/emailService');
const { getIO } = require('../sockets/socket');

/**
 * Create a notification for specific roles
 */
exports.createNotification = async ({
  title,
  message,
  recipientIds = [],
  role = 'all',
  type = 'info',
  createdBy = null,
  metadata = {}
}) => {
  try {
    const notification = await SuperNotification.create({
      title,
      message,
      recipientIds,
      role,
      type,
      createdBy,
      metadata,
      sentAt: new Date()
    });

    console.log(`✅ Notification created: ${notification._id} for role: ${role}`);

    // Emit via Socket.IO
    try {
      const io = getIO();
      
      // Emit to specific role room
      io.to(role).emit('new_notification', {
        _id: notification._id,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        metadata: notification.metadata,
        createdAt: notification.createdAt,
        isNew: true
      });

      console.log(`📤 Notification emitted to role: ${role}`);
    } catch (socketErr) {
      console.warn('⚠️ Socket emit failed:', socketErr.message);
    }

    return notification;
  } catch (error) {
    console.error('❌ Create notification error:', error);
    throw error;
  }
};

/**
 * Get notifications for a specific user/role
 */
exports.getNotifications = async (req, res) => {
  try {
    const { role, userId } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    let query = {};
    
    // Filter by role
    if (role) {
      query.$or = [
        { role: role },
        { role: 'all' }
      ];
    }

    // Filter by specific recipient
    if (userId) {
      query.recipientIds = userId;
    }

    const notifications = await SuperNotification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('createdBy', 'name email')
      .lean();

    const total = await SuperNotification.countDocuments(query);

    // Check which notifications are unread by this user
    const unreadNotifications = userId 
      ? notifications.filter(n => !n.readBy || !n.readBy.some(id => id.toString() === userId.toString()))
      : notifications;

    return res.status(200).json({
      success: true,
      message: 'Notifications fetched successfully',
      data: {
        notifications,
        unreadCount: unreadNotifications.length,
        pagination: {
          total,
          page,
          pages: Math.ceil(total / limit),
          limit
        }
      }
    });
  } catch (error) {
    console.error('❌ Get notifications error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications',
      error: error.message
    });
  }
};

/**
 * Mark notification as read
 */
exports.markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required'
      });
    }

    const notification = await SuperNotification.findById(notificationId);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    // Add user to readBy array if not already present
    if (!notification.readBy.some(id => id.toString() === userId.toString())) {
      notification.readBy.push(userId);
      await notification.save();
    }

    return res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      data: notification
    });
  } catch (error) {
    console.error('❌ Mark as read error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read',
      error: error.message
    });
  }
};

/**
 * Mark all notifications as read for a user
 */
exports.markAllAsRead = async (req, res) => {
  try {
    const { userId, role } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required'
      });
    }

    let query = {
      readBy: { $ne: userId }
    };

    if (role) {
      query.$or = [
        { role: role },
        { role: 'all' }
      ];
    }

    await SuperNotification.updateMany(
      query,
      { $addToSet: { readBy: userId } }
    );

    return res.status(200).json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('❌ Mark all as read error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as read',
      error: error.message
    });
  }
};

/**
 * Delete a notification
 */
exports.deleteNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;

    const notification = await SuperNotification.findByIdAndDelete(notificationId);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    console.error('❌ Delete notification error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete notification',
      error: error.message
    });
  }
};

exports.notifyNewOrderSuperAdmin = async (order) =>
  createAndEmitNotification({
    title:    '🛒 New Order on Platform',
    message:  `Order #${order._id?.toString()?.slice(-6)} — AED ${order.totalPayable || '0'}`,
    type:     'order',
    role:     'superAdmin',  // ✅ Only super admin
    targetId: order._id,
  });

  exports.notifyDeliveryAssigned = async (order, agencyId) =>
  createAndEmitNotification({
    title:    '📦 New Delivery Assigned',
    message:  `Order #${order._id?.toString()?.slice(-6)} assigned to your agency`,
    type:     'order',
    role:     'agency',      // ✅ Only agency
    targetId: agencyId,
  });
/**
 * Helper: Send new order notification
 */
exports.notifyNewOrder = async (order) =>
  createAndEmitNotification({
    title:    '🛒 New Order Received',
    message:  `Order #${order._id?.toString()?.slice(-6)} — AED ${order.totalPayable || '0'}`,
    type:     'order',
    role:     'shopAdmin',   // ✅ Only shop admin
    targetId: order.shopId?.toString(),
  });

/**
 * Helper: Send order status change notification
 */
exports.notifyOrderStatusChange = async (order, newStatus, shop) => {
  try {
    const shopName = shop?.shopeDetails?.shopName || 'Unknown Shop';
    const amount = order.totalPayable;

    // Notify shop
    await exports.createNotification({
      title: `Order ${newStatus}`,
      message: `Order #${order._id.toString().slice(-6)} status: ${newStatus}`,
      recipientIds: [],
      role: 'shopAdmin',
      type: 'order',
      metadata: {
        orderId: order._id.toString(),
        shopId: order.shopId.toString(),
        status: newStatus,
        amount
      }
    });

    // If delivered, notify super admin about earnings
    if (newStatus === 'Delivered') {
      await exports.createNotification({
        title: 'Order Delivered',
        message: `Order delivered at ${shopName} - AED ${amount}`,
        recipientIds: [],
        role: 'superAdmin',
        type: 'order',
        metadata: {
          orderId: order._id.toString(),
          shopId: order.shopId.toString(),
          shopName,
          amount,
          deliveryEarning: order.deliveryEarning
        }
      });
    }

    // Send email to customer
    const User = require('../models/User');
    const user = await User.findById(order.userId);
    
    if (user && user.email) {
      await sendOrderStatusEmail(
        user.email,
        order._id.toString(),
        newStatus,
        order
      );
    }

    console.log(`✅ Order status change notifications sent for: ${newStatus}`);
  } catch (error) {
    console.error('❌ Notify order status change error:', error);
  }
};

/**
 * Helper: Send payment notification
 */
exports.notifyPayment = async (payment, order) => {
  try {
    const Shop = require('../models/Shop');
    const shop = await Shop.findById(order.shopId);
    const shopName = shop?.shopeDetails?.shopName || 'Unknown Shop';

    // Notify shop
    await exports.createNotification({
      title: 'Payment Received',
      message: `Payment of AED ${payment.amount} received`,
      recipientIds: [],
      role: 'shopAdmin',
      type: 'info',
      metadata: {
        paymentId: payment._id.toString(),
        orderId: payment.orderId.toString(),
        amount: payment.amount,
        method: payment.paymentMethod
      }
    });

    console.log('✅ Payment notifications sent');
  } catch (error) {
    console.error('❌ Notify payment error:', error);
  }
};

/**
 * Helper: Send agency payment notification
 */
exports.notifyAgencyPayment = async (payout, agencyId) => {
  try {
    await exports.createNotification({
      title: 'Payout Update',
      message: `Payout of AED ${payout.totalEarnings} - ${payout.status}`,
      recipientIds: [],
      role: 'agency',
      type: 'info',
      metadata: {
        payoutId: payout._id.toString(),
        agencyId: agencyId.toString(),
        amount: payout.totalEarnings,
        status: payout.status
      }
    });

    console.log('✅ Agency payment notification sent');
  } catch (error) {
    console.error('❌ Notify agency payment error:', error);
  }
};

/**
 * Helper: Send shop verification notification
 */
exports.notifyShopVerification = async (shop, isVerified) =>
  createAndEmitNotification({
    title:    isVerified ? '✅ Shop Verified' : '❌ Verification Rejected',
    message:  isVerified
      ? `${shop.shopeDetails?.shopName || 'Your shop'} is now live on PreMart`
      : `${shop.shopeDetails?.shopName || 'Your shop'} verification was rejected. Contact support.`,
    type:     'verification',
    role:     'shopAdmin',   // ✅ Only shop admin
    targetId: shop._id,
  });

/**
 * Helper: Send agency verification notification
 */
exports.notifyAgencyVerification = async (agency, isVerified) =>
  createAndEmitNotification({
    title:    isVerified ? '✅ Agency Verified' : '❌ Verification Rejected',
    message:  isVerified
      ? `${agency.agencyDetails?.agencyName || 'Your agency'} is now active on PreMart`
      : `${agency.agencyDetails?.agencyName || 'Your agency'} verification was rejected. Contact support.`,
    type:     'verification',
    role:     'agency',      // ✅ Only agency
    targetId: agency._id,
  });

/**
 * Helper: Send registration request notification to super admin
 */
exports.notifyRegistrationRequest = async (entityType, entityId, entityName) =>
  createAndEmitNotification({
    title:    `New ${entityType} Registration`,
    message:  `${entityName} has requested to join PreMart`,
    type:     'verification',
    role:     'superAdmin',  // ✅ Only super admin
    targetId: entityId,
  });

const createAndEmitNotification = async ({ title, message, type, role, targetId = null }) => {
  try {
    const notification = await BellNotification.create({
      title, message, type,
      role,       // ✅ which role this belongs to
      targetId,   // optional: specific shop/agency/order ID
      readBy: [],
      createdAt: new Date(),
    });

    console.log(`🔔 Notification created: [${role}] ${title}`);

    try {
      const socketModule = require('../sockets/socket');
      const io = socketModule.getIO();

      // ✅ Each role has its own room — only members of that room get this
      const roomMap = { superAdmin: 'superAdmin', shopAdmin: 'shopAdmin', agency: 'agency' };
      const targetRoom = roomMap[role];

      if (targetRoom) {
        io.to(targetRoom).emit('new_notification', {
          _id: notification._id, title: notification.title,
          message: notification.message, type: notification.type,
          role: notification.role, readBy: notification.readBy,
          createdAt: notification.createdAt,
        });
        console.log(`📤 Emitted to room '${targetRoom}': ${title}`);
      }
    } catch (socketErr) {
      console.warn('⚠️ Socket emit skipped:', socketErr.message);
    }

    return notification;
  } catch (err) {
    console.error('❌ Notification error:', err.message);
    throw err;
  }
};

module.exports = exports;