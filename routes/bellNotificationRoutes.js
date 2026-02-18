// routes/notificationRoutes.js
const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/bellNotifications');

// Get notifications for a user/role
router.get('/', notificationController.getNotifications);

// Mark notification as read
router.patch('/:notificationId/read', notificationController.markAsRead);

// Mark all notifications as read
router.patch('/mark-all-read', notificationController.markAllAsRead);

// Delete notification
router.delete('/:notificationId', notificationController.deleteNotification);

module.exports = router;