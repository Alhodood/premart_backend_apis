// routes/superAdminSettingsRoutes.js
const express = require('express');
const router = express.Router();
const superAdminSettingsController = require('../controllers/superAdminSettingsController');

// Super Admin Settings routes
router.get(
  '/settings/:superAdminId',
  superAdminSettingsController.getSuperAdminSettings
);

router.put(
  '/settings/:superAdminId',
  superAdminSettingsController.updateSuperAdminSettings
);

router.post(
  '/settings/:superAdminId/reset',
  superAdminSettingsController.resetSuperAdminSettings
);

module.exports = router;