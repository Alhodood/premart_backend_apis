const express = require('express');
const router = express.Router();
const engineController = require('../controllers/engineController');

// CRUD
router.post('/', engineController.createEngine);
router.get('/', engineController.getAllEngines);
router.get('/:id', engineController.getEngineById);
router.put('/:id', engineController.updateEngine);
router.delete('/:id', engineController.deleteEngine);

module.exports = router;