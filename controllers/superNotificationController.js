const Notification = require('../models/superNotification');


exports.createNotification = async (req, res) => {
  try {
    const {
      title,
      message,
      role = 'all',
      recipientIds = [],
      isScheduled = false,
      scheduledAt
    } = req.body;

    const notification = new Notification({
      title,
      message,
      role,
      recipientIds,
      isScheduled,
      scheduledAt: isScheduled ? scheduledAt : null,
      sentAt: isScheduled ? null : new Date(),
      createdBy: req.user._id // optional: who triggered it
    });

    await notification.save();

    res.status(201).json({
      message: 'In-app notification created successfully',
      success: true,
      data: notification
    });

  } catch (error) {
    res.status(500).json({
      message: 'Failed to create notification',
      success: false,
      data: error.message
    });
  }
};


exports.getAllNotifications = async (req, res) => {
  try {
    const { search, role, type, from, to, page = 1, limit = 10 } = req.query;

    let filter = {};

    if (search) {
      filter.$or = [
        { title: new RegExp(search, 'i') },
        { message: new RegExp(search, 'i') }
      ];
    }
    if (role && role !== 'all') filter.role = role;
    if (type) filter.type = type;
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


exports.getMyNotifications = async (req, res) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;

    const data = await Notification.find({
      $or: [
        { role: userRole },
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

exports.markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.notificationId);

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found', success: false });
    }

    const userId = req.user._id;
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
    const { id } = req.params;
    const notification = await Notification.findById(id);

    if (!notification || notification.sentAt) {
      return res.status(400).json({ message: 'Only pending/scheduled notifications can be updated', success: false });
    }

    const updates = req.body;
    Object.assign(notification, updates);
    await notification.save();

    res.status(200).json({ message: 'Notification updated', success: true, data: notification });

  } catch (err) {
    res.status(500).json({ message: 'Update failed', success: false, data: err.message });
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