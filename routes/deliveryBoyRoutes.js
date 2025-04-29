const express = require('express');
const router = express.Router();
const deliveryBoyController = require('../controllers/deliveryBoyController');
const orderController = require('../controllers/orderController');

router.post('/register', deliveryBoyController.registerDeliveryBoy);

router.post('/login', deliveryBoyController.loginDeliveryBoy);

router.put('/update/:deliveryBoyId', deliveryBoyController.updateDeliveryBoy);

// View, search, filter all delivery boys
router.get('/all', deliveryBoyController.getAllDeliveryBoys);

router.delete('/delete/:deliveryBoyId', deliveryBoyController.deleteDeliveryBoy);

router.put('/update-location/:deliveryBoyId', deliveryBoyController.updateLiveLocation);

router.get('/assigned-orders/:deliveryBoyId', deliveryBoyController.viewAssignedOrders);

router.put('/accept-reject/:orderId', deliveryBoyController.deliveryBoyAcceptOrReject);

router.put('/update-delivery-status/:orderId', deliveryBoyController.deliveryBoyUpdateOrderStatus);

router.put('/raise-issue/:orderId', deliveryBoyController.deliveryBoyRaiseIssue);

// Get all delivery boys under a delivery agency
router.get('/by-agency/:agencyId', deliveryBoyController.getDeliveryBoysByAgency);

router.get('/live-locations/:agencyId', deliveryBoyController.getLiveLocationsByAgency);

router.get('/super-admin/all-delivery-boys', deliveryBoyController.getAllDeliveryBoysForMap);

router.get('/shop-admin/nearby-delivery-boys/:shopId', deliveryBoyController.getNearbyDeliveryBoysForShop);


module.exports = router;