const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');


router.post('/:userId', cartController.addToCart);

module.exports = router;