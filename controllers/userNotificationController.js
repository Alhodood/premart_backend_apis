const UserNotification = require('../models/UserNotification');
const logger = require('../config/logger'); // ← only addition at top

exports.getMyUserNotifications = async (req, res) => {
  try {
    const userId = req.params.userId;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId required' });
    }

    const { page = 1, limit = 20, unreadOnly } = req.query;
    const skip = (Math.max(1, parseInt(page, 10)) - 1) * Math.max(1, Math.min(50, parseInt(limit, 10)));
    const limitNum = Math.max(1, Math.min(50, parseInt(limit, 10)));

    const filter = { userId };
    if (unreadOnly === 'true') filter.read = false;

    const data = await UserNotification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    const total = await UserNotification.countDocuments(filter);

    return res.status(200).json({
      success: true,
      data,
      total,
      page: parseInt(page, 10),
      limit: limitNum
    });
  } catch (err) {
    logger.error('getMyUserNotifications failed', { userId: req.params.userId, error: err.message, stack: err.stack }); // ← replaced console.error
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.markUserNotificationRead = async (req, res) => {
  try {
    const { notificationId, userId } = req.params;

    const updated = await UserNotification.findOneAndUpdate(
      { _id: notificationId, userId },
      { read: true },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    logger.error('markUserNotificationRead failed', { notificationId: req.params.notificationId, userId: req.params.userId, error: err.message, stack: err.stack }); // ← replaced console.error
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.markAllUserNotificationsRead = async (req, res) => {
  try {
    const userId = req.params.userId;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId required' });
    }

    const result = await UserNotification.updateMany(
      { userId, read: false },
      { read: true }
    );

    return res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
      modifiedCount: result.modifiedCount
    });
  } catch (err) {
    logger.error('markAllUserNotificationsRead failed', { userId: req.params.userId, error: err.message, stack: err.stack }); // ← replaced console.error
    return res.status(500).json({ success: false, message: err.message });
  }
};