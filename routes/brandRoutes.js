const express = require('express');
const router = express.Router();
const brandController = require('../controllers/brandController');
// Optionally, import your authorization middleware if needed:
// const authorize = require('../middlewares/authorize');

// Create a new product (restricted to Shop Admin)
// router.post('/', authorize(['shopAdmin']), productController.createProduct);
router.post('/', brandController.createBrand);

// Retrieve all products (public)
router.get('/', brandController.getBrand);

// Retrieve a specific product by ID (public)
router.get('/:id', brandController.getBrandById);

// Update product (restricted to Shop Admin)
// router.put('/:id', authorize(['shopAdmin']), brandController.updateProduct);
router.put('/:id', brandController.updateBrand);

// Delete product (restricted to Shop Admin)
// router.delete('/:id', authorize(['shopAdmin']), brandController.deleteProduct);
router.delete('/:id', brandController.deleteBrand);

module.exports = router;
