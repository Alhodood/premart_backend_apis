const express = require('express');
const router = express.Router();
const whislistController = require('../controllers/whislistController');


router.post('/:userId', whislistController.addToWishList);
router.get('/:userId', whislistController.getWishList);

module.exports = router;