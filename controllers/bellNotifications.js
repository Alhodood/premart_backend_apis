// controllers/bellNotifications.js
const SuperNotification = require('../models/superNotification');
const {
  sendOrderStatusEmail,
  sendShopVerificationEmail,
  sendAgencyVerificationEmail
} = require('../services/emailService');
const DeliveryBoy = require('../models/DeliveryBoy');
const logger = require('../config/logger');

// ─────────────────────────────────────────────────────────────────────────────
// CORE: Create notification in DB + emit via socket to correct room
// ─────────────────────────────────────────────────────────────────────────────
const createAndEmitNotification = async ({ title, message, type, role, targetId = null }) => {
  try {
    const notification = await SuperNotification.create({
      title,
      message,
      type,
      role,
      targetId,
      readBy: [],
      createdAt: new Date(),
    });
    logger.info(`createAndEmitNotification: notification created`, { role, title, id: notification._id });

    try {
      const socketModule = require('../sockets/socket');
      const io = socketModule.getIO();

      let targetRoom;
      if (targetId && role === 'shopAdmin') {
        targetRoom = `shop_${targetId.toString()}`;
      } else if (targetId && role === 'agency') {
        targetRoom = `agency_${targetId.toString()}`;
      } else {
        const roomMap = {
          superAdmin: 'superAdmin',
          shopAdmin:  'shopAdmin',
          agency:     'agency'
        };
        targetRoom = roomMap[role];
      }

      if (targetRoom) {
        io.to(targetRoom).emit('new_notification', {
          _id:       notification._id,
          title:     notification.title,
          message:   notification.message,
          type:      notification.type,
          role:      notification.role,
          readBy:    notification.readBy,
          createdAt: notification.createdAt,
        });
        logger.info(`createAndEmitNotification: emitted to room`, { targetRoom, title });
      }
    } catch (socketErr) {
      logger.warn('createAndEmitNotification: socket emit skipped', { error: socketErr.message });
    }

    return notification;
  } catch (err) {
    logger.error('createAndEmitNotification: failed to create notification', { error: err });
    throw err;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// HTTP ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /bell-notifications
 * Query: role, userId, page, limit
 */
exports.getNotifications = async (req, res) => {
  try {
    const { role, userId } = req.query;
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip  = (page - 1) * limit;
    logger.info('getNotifications: request received', { role, userId, page, limit });

    if (!role) {
      logger.warn('getNotifications: role parameter missing');
      return res.status(400).json({ success: false, message: 'role is required' });
    }

    const roleFilter = { $or: [{ role }, { role: 'all' }] };

    let targetFilter = {};
    if (role !== 'superAdmin') {
      targetFilter = {
        $or: [
          { targetId: null },
          { targetId: { $exists: false } },
          ...(userId ? [{ targetId: userId }] : [])
        ]
      };
    }

    const query = Object.keys(targetFilter).length > 0
      ? { $and: [roleFilter, targetFilter] }
      : roleFilter;

    const notifications = await SuperNotification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await SuperNotification.countDocuments(query);
    const unreadNotifications = userId
      ? notifications.filter(n => !n.readBy?.some(id => id.toString() === userId))
      : notifications;

    logger.info('getNotifications: fetched successfully', { count: notifications.length, unreadCount: unreadNotifications.length });
    return res.status(200).json({
      success: true,
      message: 'Notifications fetched successfully',
      data: {
        notifications,
        unreadCount: unreadNotifications.length,
        pagination: { total, page, pages: Math.ceil(total / limit), limit }
      }
    });
  } catch (error) {
    logger.error('getNotifications: failed to fetch notifications', { error });
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications',
      error: error.message
    });
  }
};

/**
 * PATCH /bell-notifications/:notificationId/read
 */
exports.markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const { userId } = req.body;
    logger.info('markAsRead: request received', { notificationId, userId });

    if (!userId) {
      logger.warn('markAsRead: userId missing');
      return res.status(400).json({ success: false, message: 'userId is required' });
    }

    const notification = await SuperNotification.findById(notificationId);
    if (!notification) {
      logger.warn('markAsRead: notification not found', { notificationId });
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    if (!notification.readBy.some(id => id.toString() === userId.toString())) {
      notification.readBy.push(userId);
      await notification.save();
    }

    logger.info('markAsRead: notification marked as read', { notificationId, userId });
    return res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      data: notification
    });
  } catch (error) {
    logger.error('markAsRead: failed to mark notification as read', { error });
    return res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read',
      error: error.message
    });
  }
};

/**
 * PATCH /bell-notifications/mark-all-read
 */
exports.markAllAsRead = async (req, res) => {
  try {
    const { userId, role } = req.body;
    logger.info('markAllAsRead: request received', { userId, role });

    if (!userId) {
      logger.warn('markAllAsRead: userId missing');
      return res.status(400).json({ success: false, message: 'userId is required' });
    }

    let query = { readBy: { $ne: userId } };
    if (role) {
      query.$or = [{ role }, { role: 'all' }];
    }

    await SuperNotification.updateMany(query, { $addToSet: { readBy: userId } });

    logger.info('markAllAsRead: all notifications marked as read', { userId });
    return res.status(200).json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    logger.error('markAllAsRead: failed to mark all notifications as read', { error });
    return res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as read',
      error: error.message
    });
  }
};

/**
 * DELETE /bell-notifications/:notificationId
 */
exports.deleteNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;
    logger.info('deleteNotification: request received', { notificationId });

    const notification = await SuperNotification.findByIdAndDelete(notificationId);
    if (!notification) {
      logger.warn('deleteNotification: notification not found', { notificationId });
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    logger.info('deleteNotification: notification deleted successfully', { notificationId });
    return res.status(200).json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    logger.error('deleteNotification: failed to delete notification', { error });
    return res.status(500).json({
      success: false,
      message: 'Failed to delete notification',
      error: error.message
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Legacy createNotification (kept for backward compatibility)
// ─────────────────────────────────────────────────────────────────────────────
exports.createNotification = async ({
  title,
  message,
  recipientIds = [],
  role = 'all',
  type = 'info',
  createdBy = null,
  metadata = {},
  targetId = null
}) => {
  return createAndEmitNotification({ title, message, type, role, targetId });
};

// ─────────────────────────────────────────────────────────────────────────────
// NEW ORDER — notify shop + super admin
// ─────────────────────────────────────────────────────────────────────────────
exports.notifyNewOrder = async (order, shop) => {
  const shopName = shop?.shopeDetails?.shopName || 'Unknown Shop';
  const shortId  = order._id?.toString()?.slice(-6);

  await createAndEmitNotification({
    title:    '🛒 New Order Received',
    message:  `Order #${shortId} — AED ${order.totalPayable || '0'}`,
    type:     'order',
    role:     'shopAdmin',
    targetId: order.shopId?.toString(),
  });

  await createAndEmitNotification({
    title:    '🛒 New Order on Platform',
    message:  `${shopName} received order #${shortId} — AED ${order.totalPayable || '0'}`,
    type:     'order',
    role:     'superAdmin',
    targetId: order._id,
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// ORDER STATUS CHANGE — notify shop always; on Delivered also agency + super admin
// ─────────────────────────────────────────────────────────────────────────────
exports.notifyOrderStatusChange = async (order, newStatus, shop) => {
  try {
    const shopName = shop?.shopeDetails?.shopName || 'Unknown Shop';
    const amount   = order.totalPayable;
    const orderId  = order._id.toString();
    const shortId  = orderId.slice(-6);

    await createAndEmitNotification({
      title:    `Order ${newStatus}`,
      message:  `Order #${shortId} is now ${newStatus}`,
      type:     'order',
      role:     'shopAdmin',
      targetId: order.shopId,
    });

    if (newStatus === 'Delivered') {
      if (order.assignedDeliveryBoy) {
        try {
          const deliveryBoy = await DeliveryBoy.findById(order.assignedDeliveryBoy).lean();
          if (deliveryBoy?.agencyId) {
            await createAndEmitNotification({
              title:    '✅ Delivery Completed',
              message:  `Order #${shortId} delivered — AED ${order.deliveryEarning || 0} earned`,
              type:     'order',
              role:     'agency',
              targetId: deliveryBoy.agencyId,
            });
            logger.info('notifyOrderStatusChange: agency notified of delivery', { agencyId: deliveryBoy.agencyId });
          }
        } catch (dbErr) {
          logger.warn('notifyOrderStatusChange: could not fetch delivery boy for agency notification', { error: dbErr.message });
        }
      }

      await createAndEmitNotification({
        title:    '✅ Order Delivered',
        message:  `${shopName} — Order #${shortId} delivered. AED ${amount}`,
        type:     'order',
        role:     'superAdmin',
        targetId: order._id,
      });
    }

    try {
      const User = require('../models/User');
      const user = await User.findById(order.userId);
      if (user?.email) {
        await sendOrderStatusEmail(user.email, orderId, newStatus, order);
        logger.info('notifyOrderStatusChange: order status email sent', { email: user.email, newStatus });
      }
    } catch (emailErr) {
      logger.warn('notifyOrderStatusChange: order status email failed', { error: emailErr.message });
    }

    logger.info('notifyOrderStatusChange: all notifications sent', { newStatus, orderId });
  } catch (error) {
    logger.error('notifyOrderStatusChange: failed', { error });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELIVERY ASSIGNED — notify agency
// ─────────────────────────────────────────────────────────────────────────────
exports.notifyDeliveryAssigned = async (order, agencyId) =>
  createAndEmitNotification({
    title:    '📦 New Delivery Assigned',
    message:  `Order #${order._id?.toString()?.slice(-6)} assigned to your agency`,
    type:     'order',
    role:     'agency',
    targetId: agencyId,
  });

// ─────────────────────────────────────────────────────────────────────────────
// PAYOUT NOTIFICATIONS — targeted to specific shop / agency
// ─────────────────────────────────────────────────────────────────────────────
exports.notifyShopPayout = async (payout, shopId) => {
  try {
    const amount = payout.netPayable?.toFixed(2) || payout.totalEarnings?.toFixed(2) || '0';
    await createAndEmitNotification({
      title:    '💰 Payout Processed',
      message:  `Your payout of AED ${amount} has been processed`,
      type:     'payment',
      role:     'shopAdmin',
      targetId: shopId,
    });
    logger.info('notifyShopPayout: shop payout notification sent', { shopId, amount });
  } catch (error) {
    logger.error('notifyShopPayout: failed', { error });
  }
};

exports.notifyAgencyPayment = async (payout, agencyId) => {
  try {
    const amount = payout.totalEarnings?.toFixed(2) || '0';
    await createAndEmitNotification({
      title:    '💰 Payout Processed',
      message:  `Your agency payout of AED ${amount} has been processed`,
      type:     'payment',
      role:     'agency',
      targetId: agencyId,
    });
    logger.info('notifyAgencyPayment: agency payout notification sent', { agencyId, amount });
  } catch (error) {
    logger.error('notifyAgencyPayment: failed', { error });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// VERIFICATION — shop/agency verified or rejected
// ─────────────────────────────────────────────────────────────────────────────
exports.notifyShopVerification = async (shop, isVerified) => {
  const shopName = shop.shopeDetails?.shopName || 'Your Shop';

  try {
    const shopEmail = shop.shopeDetails?.shopMail || shop.shopeDetails?.shopEmail || shop.email;
    if (shopEmail) {
      await sendShopVerificationEmail(shopEmail, shopName, isVerified);
      logger.info('notifyShopVerification: verification email sent', { shopEmail, isVerified });
    }
  } catch (emailErr) {
    logger.error('notifyShopVerification: verification email failed', { error: emailErr.message });
  }

  await createAndEmitNotification({
    title:    isVerified ? '✅ Shop Verified' : '❌ Verification Rejected',
    message:  isVerified
      ? `${shopName} is now live on PreMart`
      : `${shopName} verification was rejected. Contact support.`,
    type:     'verification',
    role:     'shopAdmin',
    targetId: shop._id,
  });

  await createAndEmitNotification({
    title:    `Shop ${isVerified ? 'Verified' : 'Rejected'}`,
    message:  `${shopName} has been ${isVerified ? 'verified and is now live' : 'rejected'}`,
    type:     'verification',
    role:     'superAdmin',
    targetId: shop._id,
  });
};

exports.notifyAgencyVerification = async (agency, isVerified) => {
  const agencyName = agency.agencyDetails?.agencyName || 'Your Agency';

  try {
    const agencyEmail = agency.agencyDetails?.agencyMail || agency.agencyDetails?.email || agency.email;
    if (agencyEmail) {
      await sendAgencyVerificationEmail(agencyEmail, agencyName, isVerified);
      logger.info('notifyAgencyVerification: verification email sent', { agencyEmail, isVerified });
    }
  } catch (emailErr) {
    logger.error('notifyAgencyVerification: verification email failed', { error: emailErr.message });
  }

  await createAndEmitNotification({
    title:    isVerified ? '✅ Agency Verified' : '❌ Verification Rejected',
    message:  isVerified
      ? `${agencyName} is now active on PreMart`
      : `${agencyName} verification was rejected. Contact support.`,
    type:     'verification',
    role:     'agency',
    targetId: agency._id,
  });

  await createAndEmitNotification({
    title:    `Agency ${isVerified ? 'Verified' : 'Rejected'}`,
    message:  `${agencyName} has been ${isVerified ? 'verified and is now active' : 'rejected'}`,
    type:     'verification',
    role:     'superAdmin',
    targetId: agency._id,
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRATION — notify super admin of new shop/agency signup
// ─────────────────────────────────────────────────────────────────────────────
exports.notifyRegistrationRequest = async (entityType, entityId, entityName) =>
  createAndEmitNotification({
    title:    `New ${entityType} Registration`,
    message:  `${entityName} has requested to join PreMart`,
    type:     'verification',
    role:     'superAdmin',
    targetId: entityId,
  });

module.exports = exports;