const express = require('express');
const router = express.Router();
const payoutController = require('../controllers/payoutController');

// Multi-Shop Payout Summary
router.get('/summary', payoutController.multiShopPayoutSummary);

// Delivery agency payout summary
router.get('/agency-summary', payoutController.agencyPayoutSummary);

router.get('/pending/:agencyId', payoutController.getPendingPayoutsByAgency);

router.put('/mark-paid/:payoutId', payoutController.markPayoutAsPaid);

module.exports = router;