const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/superNotificationController');

const { protect } = require('../middleware/authMiddleware');
const { allowRoles } = require('../middleware/roleMiddleware');

// 💬 Authenticated + Role-protected routes
router.post('/create/:creatorId', notificationController.createNotification);
router.get('/all/:creatorId', notificationController.getAllNotifications);
router.get('/allAdmin/:creatorId', notificationController.getAllNotificationsAdmin);
router.put('/update/:id', notificationController.updateNotification);
router.delete('/:id', notificationController.deleteNotification);

// 👤 Accessible to any authenticated user
router.get('/my/:userId', notificationController.getMyNotifications);
router.patch('/mark-read/:notificationId/:userId', notificationController.markAsRead);

module.exports = router;