const express = require('express');
const router = express.Router();
const payoutController = require('../controllers/payoutController');

// ── SHOP PAYOUT ROUTES ─────────────────────────────────────────────────────
router.get('/shop/all', payoutController.getAllShopPayouts);
router.get('/shop/history/:shopId', payoutController.getShopPayoutHistory);
router.patch('/shop/mark-paid/:payoutId', payoutController.markShopPayoutAsPaid);  // ← before /:shopId
router.post('/shop/mark-paid/:payoutId', payoutController.markShopPayoutAsPaid);   // keep both methods
router.get('/shop/:shopId', payoutController.getShopPayoutById);                   // ← LAST

// ── AGENCY PAYOUT ROUTES ───────────────────────────────────────────────────
router.get('/agency/all', payoutController.getAllAgencyPayouts);
router.patch('/agency/mark-paid/:payoutId', payoutController.markAgencyPayoutAsPaid); // ← before /:agencyId
router.get('/agency/:agencyId', payoutController.getAgencyPayoutById);               // ← LAST

// ── COMBINED REPORTS ───────────────────────────────────────────────────────
router.get('/summary', payoutController.multiShopPayoutSummary);

module.exports = router;