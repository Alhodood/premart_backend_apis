// const express = require('express');
// const router = express.Router();
// const customerCardController = require('../controllers/customerCardController');
// // Optionally, import your authorization middleware if needed:
// // const authorize = require('../middlewares/authorize');

// // Create a new product (restricted to Shop Admin)
// // router.post('/', authorize(['shopAdmin']), productController.createProduct);
// router.post('/:id', customerCardController.addCustomerCard);

// // Retrieve all products (public)
// // router.get('/:id', customerAddressController.getAddress);

// // Retrieve a specific product by ID (public)
// router.get('/:id', customerCardController.getCardById);

// // Update product (restricted to Shop Admin)
// // router.put('/:id', authorize(['shopAdmin']), brandController.updateProduct);
// router.put('/:id/:cardId', customerCardController.updateCard);

// // Delete product (restricted to Shop Admin)
// // router.delete('/:id', authorize(['shopAdmin']), brandController.deleteProduct);
// router.delete('/:id/:cardId', customerCardController.deleteCard);

// module.exports = router;