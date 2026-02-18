const express = require('express');
const router = express.Router();
const agencyController = require('../controllers/agencyController');


// Register a new agency
router.post('/register', agencyController.registerAgency);

router.put('/update/:agencyId', agencyController.updateAgency);
router.delete('/delete/:agencyId', agencyController.deleteAgency);
router.get('/search', agencyController.searchAgencies);

router.get('/all', agencyController.getAllAgencies);

router.get('/agenciesPayments', agencyController.getAgenciesWithPayments);

router.get('/settings/:agencyId', agencyController.getAgencySettings);
router.put('/settings/:agencyId', agencyController.updateAgencySettings);
router.post('/settings/:agencyId/reset', agencyController.resetAgencySettings);
router.get('/by-delivery-boy/:deliveryBoyId', agencyController.getAgencyByDeliveryBoy);


module.exports = router;