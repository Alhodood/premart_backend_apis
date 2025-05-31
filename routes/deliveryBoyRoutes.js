const express = require('express');
const router = express.Router();
const deliveryBoyController = require('../controllers/deliveryBoyController');
const { toggleAvailability } = require('../controllers/deliveryBoyController');
const orderController = require('../controllers/orderController');

router.post('/send-otp', deliveryBoyController.sendOtpToDeliveryBoy);

router.post('/verify-otp', deliveryBoyController.verifyOtpForDeliveryBoy);

router.post('/resend-otp', deliveryBoyController.resendOtpToDeliveryBoy);

router.put('/update/:deliveryBoyId', deliveryBoyController.updateDeliveryBoy);

// View, search, filter all delivery boys
router.get('/all', deliveryBoyController.getAllDeliveryBoys);

router.delete('/delete/:deliveryBoyId', deliveryBoyController.deleteDeliveryBoy);

router.put('/update-location/:deliveryBoyId', deliveryBoyController.updateLiveLocation);

router.get('/assigned-orders/:deliveryBoyId', deliveryBoyController.viewAssignedOrders);

router.patch('/accept-reject/:orderId', deliveryBoyController.deliveryBoyAcceptOrReject);

router.put('/update-delivery-status/:orderId', deliveryBoyController.deliveryBoyUpdateOrderStatus);

router.put('/raise-issue/:orderId', deliveryBoyController.deliveryBoyRaiseIssue);

// Get all delivery boys under a delivery agency
router.get('/by-agency/:agencyId', deliveryBoyController.getDeliveryBoysByAgency);

router.get('/live-locations/:agencyId', deliveryBoyController.getLiveLocationsByAgency);

router.get('/super-admin/all-delivery-boys', deliveryBoyController.getAllDeliveryBoysForMap);



router.get('/nearby-delivery-boys/:shopId', deliveryBoyController.getNearbyOnlineDeliveryBoys);

router.patch('/toggle-availability/:deliveryBoyId', toggleAvailability);


router.get('/nearby-top-areas/:deliveryBoyId', deliveryBoyController.getNearbyTopOrderAreas);

router.get('/pending-orders-nearby/:deliveryBoyId', deliveryBoyController.getNearbyPendingOrders);

// Earnings history route
router.get('/earnings/:deliveryBoyId', deliveryBoyController.getDeliveryEarningsHistory);

router.get('/order-history/:deliveryBoyId', deliveryBoyController.getDeliveryOrderHistory);

router.patch('/update/:deliveryBoyId', deliveryBoyController.updateDeliveryBoyDetails);

module.exports = router;