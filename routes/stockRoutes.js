const express = require('express');
const router = express.Router();
const stockController = require('../controllers/stockController');

// View all stock for a shop
router.get('/shop/:shopId', stockController.getStockByShop);

// View stock for one product in shop
router.get('/shop/:shopId/product/:productId', stockController.getStockByProduct);

// Add or update stock
router.post('/manage', stockController.addOrUpdateStock);

// Adjust stock (add or subtract)
router.put('/adjust', stockController.adjustStock);

// Get low stock alerts
router.get('/shop/:shopId/low-stock', stockController.getLowStockItems);

// Delete stock item
router.delete('/:stockId', stockController.deleteStockItem);

router.get('/shop/:shopId/search', stockController.searchAndFilterStock);

module.exports = router;