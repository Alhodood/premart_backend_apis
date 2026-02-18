const Notification = require('../models/superNotification');
const socketService = require('../sockets/socket');
const { sendPushToUser, sendPushToToken } = require('../helper/fcmPushHelper');
const { notifyUser } = require('../helper/notificationHelper');

const DEFAULT_TITLE = 'Notification';
const NOTIFICATION_TYPE_INFO = 'info';



exports.createNotification = async (req, res) => {
  try {
    const {
      title,
      message,
      role = 'all',
      recipientIds = [],
      isScheduled = false,
      scheduledAt,
      image
    } = req.body;

    const notification = new Notification({
      title,
      message,
      role,
      recipientIds,
      isScheduled,
      scheduledAt: isScheduled && scheduledAt ? new Date(scheduledAt) : null,
      sentAt: new Date(),
      createdBy: req.params.creatorId,
      image
    });

    await notification.save();

    if (!isScheduled) {
      const titleText = title || DEFAULT_TITLE;
      const messageText = message || '';
      const data = { notificationId: String(notification._id) };

      // Targeted users: UserNotification + socket + push via notifyUser (same as orderController)
      if (recipientIds.length > 0) {
        for (const uid of recipientIds) {
          const uidStr = normalizeUserId(uid);
          if (!uidStr) continue;
          await notifyUser(uidStr, titleText, messageText, data, NOTIFICATION_TYPE_INFO)
            .catch((e) => console.warn('SuperNotification notify user failed:', uidStr, e.message));
        }
      }
      // Delivery boys: socket + push via activeDeviceToken (no UserNotification)
      else if (role === 'deliveryBoy') {
        const DeliveryBoy = require('../models/DeliveryBoy');
        const io = socketService.getIO();
        const payload = buildSocketPayload(notification, title, message, image);
        const deliveryBoys = await DeliveryBoy.find({}).select('_id activeDeviceToken').lean();

        for (const { _id, activeDeviceToken } of deliveryBoys) {
          const uidStr = _id.toString();
          io.to(uidStr).emit('new_notification', payload);
          if (activeDeviceToken) {
            await sendPushToToken(activeDeviceToken, titleText, messageText, data).catch(() => {});
          } else {
            await sendPushToUser(uidStr, titleText, messageText, data).catch(() => {});
          }
        }
      }
      // Broadcast to customers / all: UserNotification + socket + push via notifyUser
      else if (role === 'customer' || role === 'all') {
        const DeviceToken = require('../models/DeviceToken');
        const userIds = await DeviceToken.distinct('user_id', { user_id: { $ne: null } });

        for (const uid of userIds) {
          const uidStr = normalizeUserId(uid);
          if (!uidStr) continue;
          await notifyUser(uidStr, titleText, messageText, data, NOTIFICATION_TYPE_INFO)
            .catch((e) => console.warn('SuperNotification notify user failed:', uidStr, e.message));
        }
      }
    }

    return res.status(201).json({
      success: true,
      message: 'Notification created',
      data: notification
    });
  } catch (err) {
    console.error('Create notification failed:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to create notification',
      error: err.message
    });
  }
};

function normalizeUserId(uid) {
  if (uid == null) return null;
  return typeof uid.toString === 'function' ? uid.toString() : String(uid);
}

function buildSocketPayload(notification, title, message, image) {
  return {
    id: notification._id,
    title: title || DEFAULT_TITLE,
    message: message || '',
    image: image || '',
    createdAt: notification.createdAt?.toISOString?.() || new Date().toISOString()
  };
}


exports.getAllNotifications = async (req, res) => {
  try {
    const {
      search,
      role,
      type,
      from,
      to,
      page = 1,
      limit = 10,
      status,
      sendNowOnly
    } = req.query;

    let filter = {};

    if (search) {
      filter.$or = [
        { title: new RegExp(search, 'i') },
        { message: new RegExp(search, 'i') }
      ];
    }
    if (role && role !== 'all') filter.role = role;

    if (type === 'Scheduled') {
      filter.isScheduled = true;
      filter.scheduledAt = { $gt: new Date() };
    } else if (type === 'Sent') {
      filter.isScheduled = true;
      filter.scheduledAt = { $lte: new Date() };
    }

    if (sendNowOnly === 'true') {
      filter.isScheduled = false;
    }

    if (from && to) {
      filter.createdAt = {
        $gte: new Date(from),
        $lte: new Date(to)
      };
    }

    const data = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Notification.countDocuments(filter);

    res.status(200).json({
      message: 'Notifications fetched successfully',
      success: true,
      total,
      page,
      limit: parseInt(limit),
      data
    });

  } catch (err) {
    res.status(500).json({ message: 'Error fetching notifications', success: false, data: err.message });
  }
};


exports.getAllNotificationsAdmin = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const data = await Notification.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Notification.countDocuments();

    const formattedData = data.map(n => ({
      _id: n._id,
      title: n.title,
      message: n.message,
      type: n.type,
      isScheduled: n.isScheduled,
      scheduledAt: n.scheduledAt,
      dateSent: n.sentAt,
      createdAt: n.createdAt
    }));

    res.status(200).json({
      message: 'Notifications fetched successfully',
      success: true,
      total,
      page,
      limit,
      data: formattedData
    });

  } catch (err) {
    res.status(500).json({ message: 'Error fetching notifications', success: false, data: err.message });
  }
};


exports.getMyNotifications = async (req, res) => {
  try {
    const userId = req.params.userId;

    const data = await Notification.find({
      $or: [
        { role: 'all' },
        { recipientIds: userId }
      ]
    }).sort({ createdAt: -1 });

    res.status(200).json({
      message: 'My notifications',
      success: true,
      data
    });

  } catch (err) {
    res.status(500).json({ message: 'Error', success: false, data: err.message });
  }
};
exports.getAllUserNotifications = async (req, res) => {
  try {
    const userId = req.params.userId;

    const notifications = await Notification.find({
      $or: [
        { role: 'all' },
        { role: req.query.role || 'customer' }, // optional: filter by role
        { recipientIds: userId } // targeted notifications
      ],
      readBy: { $ne: userId } // exclude notifications already read
    })
    .sort({ createdAt: -1 }); // optional: latest first

    res.status(200).json({
      success: true,
      message: 'Unread notifications fetched successfully',
      data: notifications
    });
    
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications',
      error: err.message
    });
  }
};


exports.markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.notificationId);

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found', success: false });
    }

    const userId = req.params.userId;
    if (!notification.readBy.includes(userId)) {
      notification.readBy.push(userId);
      await notification.save();
    }

    res.status(200).json({
      message: 'Marked as read',
      success: true
    });

  } catch (err) {
    res.status(500).json({ message: 'Failed to mark as read', success: false, data: err.message });
  }
};


exports.updateNotification = async (req, res) => {
  try {
    const notificationId = req.params.id;
    // Ensure notification exists and is scheduled
    const notification = await Notification.findById(notificationId);
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found', success: false });
    }
    if (!notification.isScheduled) {
      return res.status(400).json({ message: 'Only scheduled notifications can be updated', success: false });
    }

    // Perform update and return the new document
    const updated = await Notification.findByIdAndUpdate(
      notificationId,
      req.body,
      { new: true, runValidators: true }
    );
    return res.status(200).json({ message: 'Notification updated', success: true, data: updated });
  } catch (err) {
    return res.status(500).json({ message: 'Update failed', success: false, data: err.message });
  }
};



exports.deleteNotification = async (req, res) => {
  try {
    const result = await Notification.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ message: 'Not found', success: false });

    res.status(200).json({ message: 'Deleted successfully', success: true });

  } catch (err) {
    res.status(500).json({ message: 'Delete failed', success: false, data: err.message });
  }
};