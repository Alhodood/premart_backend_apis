const express = require('express');
const router = express.Router();
const whislistController = require('../controllers/whislistController');

// Check if product is in wishlist (must be before /:userId route)
router.get('/check/:userId', whislistController.checkWishlistStatus);

// Get wishlist product IDs only (lightweight for status checking)
router.get('/ids/:userId', whislistController.getWishlistProductIds);

// Get wishlist with all products data populated (ShopProduct + part + shop)
router.get('/products/:userId', whislistController.getWishListWithProducts);

// Add/Remove from wishlist
router.post('/:userId', whislistController.addToWishList);

// Get full wishlist (IDs only)
router.get('/:userId', whislistController.getWishList);

module.exports = router;