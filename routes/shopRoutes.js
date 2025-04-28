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

module.exports = router;
