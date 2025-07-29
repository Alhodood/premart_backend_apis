const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');



router.post("/add/:userId", cartController.addToCart);
router.post("/remove/:userId", cartController.removeFromCart);
router.get("/:userId", cartController.getCart);


module.exports = router;