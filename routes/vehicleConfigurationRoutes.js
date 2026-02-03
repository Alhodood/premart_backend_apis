const express = require('express');
const router = express.Router();
const controller = require('../controllers/vehicleConfigurationController');

// CRUD
router.post('/', controller.createConfig);
router.get('/', controller.getAllConfigs);
router.get('/search', controller.searchConfigs);
router.get('/search/vin', controller.searchByVin); // VIN pattern search
router.get('/:id', controller.getConfigById);
router.put('/:id', controller.updateConfig);
router.delete('/delete/:id', controller.deleteConfig);

module.exports = router;