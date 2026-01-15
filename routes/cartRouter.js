const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');

// Add product to cart
router.post('/add/:userId', cartController.addToCart);

// Remove product from cart
router.post('/remove/:userId', cartController.removeFromCart);

// Update quantity
router.patch('/update/:userId', cartController.updateQuantity);

// Get cart
router.get('/:userId', cartController.getCart);

// Clear cart
router.delete('/clear/:userId', cartController.clearCart);

module.exports = router;