const express = require('express');
const router = express.Router();
const controller = require('../controllers/vehicleConfigurationController');

// CRUD
router.post('/', controller.createConfig);
router.get('/', controller.getAllConfigs);
router.get('/search', controller.searchConfigs);
router.get('/:id', controller.getConfigById);
router.put('/:id', controller.updateConfig);
router.delete('/:id', controller.deactivateConfig);

module.exports = router;