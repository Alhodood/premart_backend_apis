const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/superNotificationController');

// Create Notification (send now or schedule)
router.post('/create', notificationController.createNotification);

// View All / Search / Filter Notifications
router.get('/all', notificationController.getAllNotifications);

module.exports = router;