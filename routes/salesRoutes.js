const express = require('express');
const router = express.Router();
const salesController = require('../controllers/salesController');

// Super Admin Sales
router.get('/super-admin', salesController.superAdminSalesReport);

// Shop Admin Sales
router.get('/shop-admin/:shopId', salesController.shopAdminSalesReport);

// Super Admin Sales Graph
router.get('/graph/super-admin', salesController.superAdminSalesGraph);

// Shop Admin Sales Graph
router.get('/graph/shop-admin/:shopId', salesController.shopAdminSalesGraph);

module.exports = router;