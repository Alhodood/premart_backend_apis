const express = require('express');
const router = express.Router();
const whislistController = require('../controllers/whislistController');


router.post('/:userId', whislistController.addToWishList);
module.exports = router;