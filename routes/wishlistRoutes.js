const express = require('express');
const router = express.Router();
const whislistController = require('../controllers/whislistController');

// Check if product is in wishlist (must be before /:userId route)
router.get('/check/:userId', whislistController.checkWishlistStatus);

// Get wishlist product IDs only (lightweight for status checking)
router.get('/ids/:userId', whislistController.getWishlistProductIds);

// Add/Remove from wishlist
router.post('/:userId', whislistController.addToWishList);

// Get full wishlist with products
router.get('/:userId', whislistController.getWishList);

module.exports = router;