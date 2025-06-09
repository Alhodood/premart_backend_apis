const express = require('express');
const router = express.Router();

const reportController = require('../controllers/reportController');

//router.get('/agency/download', generateReport.generateAgencyReportCsv);

router.get('/orders/cancelled', reportController.getCancelledOrders);
router.get('/orders/returned', reportController.getReturnedOrders);

router.get('/sales/daily', reportController.getDailySales);
router.get('/sales/weekly', reportController.getWeeklySales);
router.get('/sales/monthly', reportController.getMonthlySales);
router.get('/shop-sales', reportController.getShopWiseSales);

router.get('/products/top-selling', reportController.getTopSellingProducts);
router.get('/products/low-selling', reportController.getLowSellingProducts);
router.get('/stock/low', reportController.getLowStockParts);
router.get('/stock/out-of-stock', reportController.getOutOfStockParts);

router.get('/buyers/top', reportController.getTopBuyers);

router.get('/coupons/most-used', reportController.getMostUsedCoupons);

module.exports = router;
