const express = require('express');
const router = express.Router();
const transmissionController = require('../controllers/transmissionController');

// CRUD Routes
router.post('/', transmissionController.createTransmission);
router.get('/', transmissionController.getAllTransmissions);
router.get('/:id', transmissionController.getTransmissionById);
router.put('/:id', transmissionController.updateTransmission);
router.delete('/:id', transmissionController.deleteTransmission);

module.exports = router;