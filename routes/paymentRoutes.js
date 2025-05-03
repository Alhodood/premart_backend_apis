const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

// Create payment
router.post('/create', paymentController.createPayment);

// Update payment status + auto link order
router.put('/update-status/:paymentId', paymentController.updatePaymentStatus);

// Super Admin: View all payments
router.get('/all', paymentController.getAllPayments);

// Shop Admin: View shop payments
router.get('/shop/:shopId', paymentController.getShopPayments);

// User: View user payments
router.get('/user/:userId', paymentController.getUserPayments);

// Payment summary
router.get('/summary', paymentController.paymentSummary);

// Super Admin Search Payments
router.get('/search/super-admin', paymentController.searchPaymentsSuperAdmin);

// Shop Admin Search Payments
router.get('/search/shop-admin/:shopId', paymentController.searchPaymentsShopAdmin);

module.exports = router;