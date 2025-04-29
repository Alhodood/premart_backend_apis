const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoiceController');

// Generate Payment Invoice
router.get('/generate/:paymentId', invoiceController.generateInvoice);

module.exports = router;