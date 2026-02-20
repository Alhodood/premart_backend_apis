// controllers/bellNotifications.js
const SuperNotification = require('../models/superNotification');
const {
  sendOrderStatusEmail,
  sendShopVerificationEmail,
  sendAgencyVerificationEmail
} = require('../services/emailService');
const DeliveryBoy = require('../models/DeliveryBoy');


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

    console.log(`🔔 Notification created: [${role}] ${title}`);

    try {
      const socketModule = require('../sockets/socket');
      const io = socketModule.getIO();

      // ✅ Route to specific room:
      // - shopAdmin with targetId  → shop_{shopId}    (only that shop)
      // - agency with targetId     → agency_{agencyId} (only that agency)
      // - superAdmin               → superAdmin room   (all super admins)
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

    if (!role) {
      return res.status(400).json({ success: false, message: 'role is required' });
    }

    // Role filter — match role OR 'all'
    const roleFilter = {
      $or: [{ role }, { role: 'all' }]
    };

    // Target filter:
    // superAdmin → no targetId filter (sees everything for superAdmin role)
    // shopAdmin/agency → filter by their own ID
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
    console.error('❌ Get notifications error:', error);
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

    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required' });
    }

    const notification = await SuperNotification.findById(notificationId);
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

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
 * PATCH /bell-notifications/mark-all-read
 */
exports.markAllAsRead = async (req, res) => {
  try {
    const { userId, role } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required' });
    }

    let query = { readBy: { $ne: userId } };

    if (role) {
      query.$or = [{ role }, { role: 'all' }];
    }

    await SuperNotification.updateMany(query, { $addToSet: { readBy: userId } });

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
 * DELETE /bell-notifications/:notificationId
 */
exports.deleteNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;

    const notification = await SuperNotification.findByIdAndDelete(notificationId);
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
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

  // ✅ Notify the specific shop that received the order
  await createAndEmitNotification({
    title:    '🛒 New Order Received',
    message:  `Order #${shortId} — AED ${order.totalPayable || '0'}`,
    type:     'order',
    role:     'shopAdmin',
    targetId: order.shopId?.toString(),
  });

  // ✅ Notify super admin about new platform order
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

    // ✅ Always notify the specific shop about status change
    await createAndEmitNotification({
      title:    `Order ${newStatus}`,
      message:  `Order #${shortId} is now ${newStatus}`,
      type:     'order',
      role:     'shopAdmin',
      targetId: order.shopId,
    });

    // ✅ On Delivered — notify agency + super admin
    if (newStatus === 'Delivered') {

      // ✅ 1. Find delivery boy's agency and notify them
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
            console.log(`✅ Agency ${deliveryBoy.agencyId} notified of delivery`);
          }
        } catch (dbErr) {
          console.warn('⚠️ Could not fetch delivery boy for agency notification:', dbErr.message);
        }
      }

      // ✅ 2. Notify super admin
      await createAndEmitNotification({
        title:    '✅ Order Delivered',
        message:  `${shopName} — Order #${shortId} delivered. AED ${amount}`,
        type:     'order',
        role:     'superAdmin',
        targetId: order._id,
      });
    }

    // ✅ Send email to customer
    try {
      const User = require('../models/User');
      const user = await User.findById(order.userId);
      if (user?.email) {
        await sendOrderStatusEmail(user.email, orderId, newStatus, order);
        console.log(`✅ Order status email sent to: ${user.email}`);
      }
    } catch (emailErr) {
      console.warn('⚠️ Order status email failed:', emailErr.message);
    }

    console.log(`✅ Order status notifications sent: ${newStatus}`);
  } catch (error) {
    console.error('❌ Notify order status change error:', error);
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

/**
 * Call after creating/updating a ShopPayout
 */
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
    console.log(`✅ Shop payout notification sent to shop: ${shopId}`);
  } catch (error) {
    console.error('❌ Shop payout notification error:', error);
  }
};

/**
 * Call after creating/updating an AgencyPayout
 */
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
    console.log(`✅ Agency payout notification sent to agency: ${agencyId}`);
  } catch (error) {
    console.error('❌ Agency payout notification error:', error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// VERIFICATION — shop/agency verified or rejected
// ─────────────────────────────────────────────────────────────────────────────

exports.notifyShopVerification = async (shop, isVerified) => {
  const shopName = shop.shopeDetails?.shopName || 'Your Shop';

  // Send email to shop
  try {
    const shopEmail = shop.shopeDetails?.shopMail || shop.shopeDetails?.shopEmail || shop.email;
    if (shopEmail) {
      await sendShopVerificationEmail(shopEmail, shopName, isVerified);
      console.log(`✅ Shop verification email sent to: ${shopEmail}`);
    }
  } catch (emailErr) {
    console.error('❌ Shop verification email failed:', emailErr.message);
  }

  // ✅ Notify the specific shop
  await createAndEmitNotification({
    title:    isVerified ? '✅ Shop Verified' : '❌ Verification Rejected',
    message:  isVerified
      ? `${shopName} is now live on PreMart`
      : `${shopName} verification was rejected. Contact support.`,
    type:     'verification',
    role:     'shopAdmin',
    targetId: shop._id,
  });

  // ✅ Notify super admin of the action
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

  // Send email to agency
  try {
    const agencyEmail = agency.agencyDetails?.agencyMail || agency.agencyDetails?.email || agency.email;
    if (agencyEmail) {
      await sendAgencyVerificationEmail(agencyEmail, agencyName, isVerified);
      console.log(`✅ Agency verification email sent to: ${agencyEmail}`);
    }
  } catch (emailErr) {
    console.error('❌ Agency verification email failed:', emailErr.message);
  }

  // ✅ Notify the specific agency
  await createAndEmitNotification({
    title:    isVerified ? '✅ Agency Verified' : '❌ Verification Rejected',
    message:  isVerified
      ? `${agencyName} is now active on PreMart`
      : `${agencyName} verification was rejected. Contact support.`,
    type:     'verification',
    role:     'agency',
    targetId: agency._id,
  });

  // ✅ Notify super admin of the action
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