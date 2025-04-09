const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
// Optionally, import your authorization middleware if needed:
// const authorize = require('../middlewares/authorize');

// Create a new product (restricted to Shop Admin)
// router.post('/', authorize(['shopAdmin']), productController.createProduct);
router.post('/', productController.createProduct);

// Retrieve all products (public)
router.get('/', productController.getProducts);

// Retrieve a specific product by ID (public)
router.get('/:id', productController.getProductById);

// Update product (restricted to Shop Admin)
// router.put('/:id', authorize(['shopAdmin']), productController.updateProduct);
router.put('/:id', productController.updateProduct);

// Delete product (restricted to Shop Admin)
// router.delete('/:id', authorize(['shopAdmin']), productController.deleteProduct);
router.delete('/:id', productController.deleteProduct);

module.exports = router;
