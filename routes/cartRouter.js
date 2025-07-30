const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');



router.post("/add/:userId", cartController.addToCart);
router.post("/remove/:userId", cartController.removeFromCart);
router.get("/:userId", cartController.getCart);

// Remove an entire product from the cart
router.delete("/:userId/product/:productId", cartController.deleteProductFromCart);

module.exports = router;