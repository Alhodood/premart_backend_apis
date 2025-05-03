const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/superNotificationController');

const { protect } = require('../middleware/authMiddleware');
const { allowRoles } = require('../middleware/roleMiddleware');

// 💬 Authenticated + Role-protected routes
router.post('/create', protect, allowRoles('superAdmin', 'shopAdmin'), notificationController.createNotification);
router.get('/all', protect, allowRoles('superAdmin', 'shopAdmin'), notificationController.getAllNotifications);
router.put('/update/:id', protect, allowRoles('superAdmin', 'shopAdmin'), notificationController.updateNotification);
router.delete('/:id', protect, allowRoles('superAdmin', 'shopAdmin'), notificationController.deleteNotification);

// 👤 Accessible to any authenticated user
router.get('/my', protect, notificationController.getMyNotifications);
router.patch('/mark-read/:notificationId', protect, notificationController.markAsRead);

module.exports = router;