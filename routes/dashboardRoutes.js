// routes/shopDashboardRoutes.js
const express = require('express');
const router = express.Router();
const { protect, allowRoles } = require('../middleware/authMiddleware');
const { getShopDashboardByShopId,getSuperAdminDashboard } = require('../controllers/dashboardController');

// Allow super admin or shop admin
router.get('/shopAdmin/analytics/:shopId', getShopDashboardByShopId);
router.get('/superAdmin/analytics', getSuperAdminDashboard);

module.exports = router;