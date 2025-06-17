const express = require('express');
const router = express.Router();
const vinDataController = require('../controllers/vinDataController');


router.post('/', vinDataController.createVinEntry);
router.get('/:vinData', vinDataController.getVinByKey);

module.exports = router;