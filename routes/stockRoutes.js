const express = require('express');
const router = express.Router();
const stockController = require('../controllers/stockController');

// Get all stock for shop
router.get('/shop/:shopId', stockController.getStockByShop);

// Get stock for one product
router.get('/shop/:shopId/product/:productId', stockController.getStockByProduct);

// Set stock directly
router.patch('/product/:productId/stock', stockController.updateStock);

// Adjust stock (+/-)
router.patch('/product/:productId/adjust', stockController.adjustStock);

// Low stock
router.get('/shop/:shopId/low-stock', stockController.getLowStock);

module.exports = router;