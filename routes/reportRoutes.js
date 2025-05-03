const express = require('express');
const router = express.Router();
const  generateReport  = require('../controllers/reportController');

router.get('/agency/download', generateReport.generateAgencyReportCsv);
router.get('/banner/download', generateReport.generateBannerReportCsv);
router.get('/brands', generateReport.getBrandReport);
router.get('/categories', generateReport.getCategoryReport);
router.get('/coupons', generateReport.getCouponReport);
router.get('/delivery-agencies', generateReport.getDeliveryAgencyReport);
router.get('/delivery-boys', generateReport.getDeliveryBoyReport);
router.get('/fuel', generateReport.getFuelReport);
router.get('/models', generateReport.getModelReport);
router.get('/offers', generateReport.getOfferReport);
router.get('/orders', generateReport.getOrderReport);
router.get('/payments', generateReport.getPaymentReport);
router.get('/products', generateReport.getProductReport);
router.get('/shops', generateReport.getShopReport);
router.get('/stock', generateReport.getStockReport);
router.get('/super-notifications', generateReport.getSuperNotificationReport);
router.get('/users', generateReport.getUserReport);
router.get('/years', generateReport.getYearReport);



module.exports = router;