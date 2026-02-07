// routes/productRatingRoutes.js
const express = require('express');
const router = express.Router();
const ratingController = require('../controllers/productRatingController');


// Add a new rating (POST /api/rating)
router.post('/', ratingController.addRating);

// Update a rating (PUT /api/rating/:ratingId)
router.put('/:ratingId', ratingController.updateRating);

// Delete a rating (DELETE /api/rating/:ratingId)
router.delete('/:ratingId', ratingController.deleteRating);
// router.delete('/ratings/:ratingId',authMiddleware,
//     ratingController.deleteRating
// );


// Check if user can rate a product (GET /api/rating/can-rate)
router.get('/can-rate', ratingController.canRate);

// Get rating summary for a shop product (GET /api/rating/summary/:shopProductId)
router.get('/summary/:shopProductId', ratingController.getRatingSummary);

// Get all ratings for a shop product (GET /api/rating/product/:shopProductId)
router.get('/product/:shopProductId', ratingController.getRatingsByShopProduct);

// Get all ratings for a part across all shops (GET /api/rating/part/:partId)
router.get('/part/:partId', ratingController.getRatingsByPart);

// Get all ratings for a shop (GET /api/rating/shop/:shopId)
router.get('/shop/:shopId', ratingController.getRatingsByShop);

// Get user's own ratings (GET /api/rating/user/:userId)
router.get('/user/:userId', ratingController.getUserRatings);

module.exports = router;
