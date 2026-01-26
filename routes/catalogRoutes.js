const express = require("express");
const router = express.Router();
const partsController = require('../controllers/partsCatalogController');
const shopProductController = require('../controllers/shopProductController');


// ========== PARTS CATALOG ==========
router.post('/catalog', partsController.createPart);
router.get('/getParts', partsController.getAllParts);
router.patch('/catalog/:id', partsController.updatePart);
router.get('/catalog/getPartsById/:id', partsController.getPartById);
router.get('/catalog/search/query', partsController.searchParts);
router.get('/catalog/search/part-number', partsController.searchByPartNumber); // Part number search

// ========== SHOP PRODUCTS ==========
router.post('/shop-product/:shopId', shopProductController.addShopProduct);
router.get('/shop-product/:shopId', shopProductController.getShopProducts);
router.patch('/shop-product/:id', shopProductController.updateShopProduct);
router.delete('/shop-product/:id', shopProductController.deleteShopProduct);

module.exports = router;