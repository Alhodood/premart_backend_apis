const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
// Optionally, import your authorization middleware if needed:
// const authorize = require('../middlewares/authorize');

// Create a new product (restricted to Shop Admin)
// router.post('/', authorize(['shopAdmin']), productController.createProduct);
router.post('/', categoryController.createCategories);

// Retrieve all products (public)
router.get('/', categoryController.getCategory);

// Retrieve a specific product by ID (public)
router.get('/:id', categoryController.getCategoriesById);

// Update product (restricted to Shop Admin)
// router.put('/:id', authorize(['shopAdmin']), categoryController.updateProduct);
router.put('/:id', categoryController.updateCategory);

// Delete product (restricted to Shop Admin)
// router.delete('/:id', authorize(['shopAdmin']), categoryController.deleteProduct);
router.delete('/:id', categoryController.deleteCategories);

module.exports = router;
