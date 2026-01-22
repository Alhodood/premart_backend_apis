const Notification = require('../models/superNotification');
const socketService = require('../sockets/socket');


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

    console.log("🟡 Notification saved:", notification._id);

    const io = socketService.getIO();
    const connectedUsers = socketService.getConnectedUsers();

    console.log("🟡 Active users:", connectedUsers);

    if (!isScheduled) {

      // Targeted
      if (recipientIds.length > 0) {
        recipientIds.forEach(uid => {
          console.log("🟢 Emit to:", uid);

          io.to(uid.toString()).emit("new_notification", {
            id: notification._id,
            title,
            message,
            image,
            createdAt: notification.createdAt,
          });
        });
      }

      // Role broadcast
      else if (role === 'deliveryBoy') {
        Object.keys(connectedUsers).forEach(uid => {
          console.log("🟢 Broadcast to:", uid);

          io.to(uid).emit("new_notification", {
            id: notification._id,
            title,
            message,
            image,
            createdAt: notification.createdAt,
          });
        });
      }
    }

    return res.status(201).json({
      success: true,
      message: 'Notification created',
      data: notification
    });

  } catch (err) {
    console.error("❌ Create notification failed:", err);
    return res.status(500).json({
      success: false,
      message: 'Failed to create notification',
      error: err.message
    });
  }
};


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