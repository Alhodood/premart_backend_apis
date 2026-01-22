// routes/shopDashboardRoutes.js OR create reportRoutes.js
const express = require('express');
const router = express.Router();
const { protect, allowRoles } = require('../middleware/authMiddleware');
const { 
  getShopDashboardByShopId,
  getSuperAdminDashboard, 
  getWeeklySales,
  getOrderStatusDistribution 
} = require('../controllers/dashboardController');

// Dashboard routes
router.get('/shopAdmin/analytics/:shopId', getShopDashboardByShopId);
router.get('/superAdmin/analytics', getSuperAdminDashboard);

// Report routes (used by graphs)
router.get('/sales/weekly', getWeeklySales);
router.get('/order-status-distribution', getOrderStatusDistribution); 

module.exports = router;