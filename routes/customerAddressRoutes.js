const express = require('express');
const router = express.Router();
const customerAddressController = require('../controllers/customerAddressController');
// Optionally, import your authorization middleware if needed:
// const authorize = require('../middlewares/authorize');

// Create a new product (restricted to Shop Admin)
// router.post('/', authorize(['shopAdmin']), productController.createProduct);
router.post('/:id', customerAddressController.addCustomerAddress);

// Retrieve all products (public)
// router.get('/:id', customerAddressController.getAddress);

// Retrieve a specific product by ID (public)
router.get('/:id', customerAddressController.getAddressById);

// Update product (restricted to Shop Admin)
// router.put('/:id', authorize(['shopAdmin']), brandController.updateProduct);
router.put('/:id/:addressId', customerAddressController.updateAddress);

// Delete product (restricted to Shop Admin)
// router.delete('/:id', authorize(['shopAdmin']), brandController.deleteProduct);
router.delete('/:id/:addressId', customerAddressController.deleteAddress);

module.exports = router;