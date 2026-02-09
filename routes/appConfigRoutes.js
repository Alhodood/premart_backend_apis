// routes/appConfigRoutes.js
// PUBLIC routes for customer mobile apps - NO AUTH REQUIRED
const express = require('express');
const router = express.Router();
const appConfigController = require('../controllers/appConfigController');

// GET /api/app-config - Public endpoint for mobile apps
router.get('/', appConfigController.getAppConfig);

module.exports = router;
