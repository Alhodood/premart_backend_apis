const express = require('express');
const router = express.Router();
const shopController = require('../controllers/shopController');
// Optionally, import your authorization middleware if needed:
// const authorize = require('../middlewares/authorize');

router.post('/', shopController.createShop);

router.get('/', shopController.getAllShops);

router.get('/:shopId', shopController.getShopById);

router.put('/:id', shopController.updateShop);

router.delete('/:shopId', shopController.deleteShop);

// Super Admin Filter/Search Shops
router.get('/search', shopController.searchShopsForSuperAdmin);

router.patch('/shop-mark-order-ready/:orderId', shopController.shopConfirmReady);

module.exports = router;
