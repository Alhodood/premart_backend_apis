const express = require('express');
const router = express.Router();
const userNotificationController = require('../controllers/userNotificationController');

router.get('/:userId', userNotificationController.getMyUserNotifications);
router.patch('/:notificationId/read/:userId', userNotificationController.markUserNotificationRead);

module.exports = router;
