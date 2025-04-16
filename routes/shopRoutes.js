const express = require('express');
const router = express.Router();
const shopController = require('../controllers/shopController');
// Optionally, import your authorization middleware if needed:
// const authorize = require('../middlewares/authorize');

// Create a new product (restricted to Shop Admin)
// router.post('/', authorize(['shopAdmin']), productController.createProduct);
router.post('/', shopController.createShop);

// Retrieve all products (public)
router.get('/', shopController.getShop);

// Retrieve a specific product by ID (public)
router.get('/:id', shopController.getShopById);

// Update product (restricted to Shop Admin)
// router.put('/:id', authorize(['shopAdmin']), brandController.updateProduct);
router.put('/:id', shopController.updateShop);

// Delete product (restricted to Shop Admin)
// router.delete('/:id', authorize(['shopAdmin']), brandController.deleteProduct);
router.delete('/:id', shopController.deleteShop);

module.exports = router;