const express = require('express');
const router = express.Router();
const payoutController = require('../controllers/payoutController');

// Multi-Shop Payout Summary
router.get('/summary', payoutController.multiShopPayoutSummary);



// routes/payoutRoutes.js
router.post('/shop/mark-paid/:payoutId', payoutController.markShopPayoutAsPaid);
router.get('/shop/history/:shopId', payoutController.getShopPayoutHistory);



// ==========================================
// AGENCY PAYOUT ROUTES
// ==========================================
router.get('/agency/all', payoutController.getAllAgencyPayouts);
router.get('/agency/:agencyId', payoutController.getAgencyPayoutById);
router.patch('/agency/mark-paid/:payoutId', payoutController.markAgencyPayoutAsPaid); // ✅ Changed

// ==========================================
// SHOP PAYOUT ROUTES
// ==========================================
router.get('/shop/all', payoutController.getAllShopPayouts);
router.get('/shop/:shopId', payoutController.getShopPayoutById);
router.patch('/shop/mark-paid/:payoutId', payoutController.markShopPayoutAsPaid);

// ==========================================
// COMBINED REPORTS
// ==========================================
router.get('/summary', payoutController.getPayoutSummary);

module.exports = router;

module.exports = router;