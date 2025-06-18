const express = require('express');
const router = express.Router();
const refundController = require('../controllers/refundController');

// Customer requests refund
router.put('/request/:orderId', refundController.requestRefund);

// Admin approves refund
router.put('/approve/:orderId', refundController.approveRefund);

module.exports = router;