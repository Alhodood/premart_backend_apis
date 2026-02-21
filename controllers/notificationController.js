const Notification = require('../models/Notification');
const logger = require('../config/logger'); // ← Winston logger

// Create a new notification
exports.createNotification = async (req, res) => {
  try {
    const shopId = req.params.id;
    const { title, content, pic } = req.body;

    if (!shopId || !title || !content) {
      return res.status(400).json({ message: "Missing required fields", success: false });
    }

    const newNotification = new Notification({ shopId, title, content, pic });
    await newNotification.save();
    res.status(201).json({ message: "Notification created", success: true, data: newNotification });

  } catch (error) {
    logger.error('Failed to create notification: ' + error.message, { stack: error.stack });
    res.status(500).json({ message: "Failed to create notification", success: false, error: error.message });
  }
};

// Get all notifications
exports.getAllNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find().sort({ createdAt: -1 });
    res.status(200).json({ message: "Notifications fetched", success: true, data: notifications });

  } catch (error) {
    logger.error('Failed to fetch notifications: ' + error.message, { stack: error.stack });
    res.status(500).json({ message: "Failed to fetch notifications", success: false, error: error.message });
  }
};

// Get notification by ID
exports.getNotificationById = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) {
      return res.status(404).json({ message: "Notification not found", success: false });
    }
    res.status(200).json({ message: "Notification found", success: true, data: notification });

  } catch (error) {
    logger.error('Error fetching notification: ' + error.message, { stack: error.stack });
    res.status(500).json({ message: "Error fetching notification", success: false, error: error.message });
  }
};

// Update notification
exports.updateNotification = async (req, res) => {
  try {
    const updated = await Notification.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) {
      return res.status(404).json({ message: "Notification not found", success: false });
    }
    res.status(200).json({ message: "Notification updated", success: true, data: updated });

  } catch (error) {
    logger.error('Notification update failed: ' + error.message, { stack: error.stack });
    res.status(500).json({ message: "Update failed", success: false, error: error.message });
  }
};

// Delete notification
exports.deleteNotification = async (req, res) => {
  try {
    const deleted = await Notification.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "Notification not found", success: false });
    }
    res.status(200).json({ message: "Notification deleted", success: true });

  } catch (error) {
    logger.error('Notification delete failed: ' + error.message, { stack: error.stack });
    res.status(500).json({ message: "Delete failed", success: false, error: error.message });
  }
};