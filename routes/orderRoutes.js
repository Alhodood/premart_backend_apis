const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { protect } = require('../middleware/authMiddleware');


router.post('/create/:userId',orderController.createOrder);

router.post('/create-direct/:userId', orderController.createOrderFromDirectBuy);

router.get('/my-orders/:userId',orderController.viewMyOrders);

router.get('/all-orders', orderController.getAllOrders);

router.get('/cancelled', orderController.getAllCancelledOrders);

router.get('/all-pending-orders', orderController.getAllPendingOrders);

router.get('/shop-orders/:shopId', orderController.viewOrdersByShopAdmin);

router.put('/update-status/:orderId', orderController.updateOrderStatus);

router.put('/cancel/:orderId', orderController.cancelOrder);

router.get('/cancellation-reasons', orderController.getCancellationReasons);

router.put('/refund/:orderId', orderController.refundOrder);


router.put('/customer/refund-request/:orderId', orderController.customerRaiseRefundRequest);

//---------  

router.put('/delivery-boy/accept-reject/:orderId', orderController.deliveryBoyAcceptRejectOrder);

router.put('/assign-delivery-boy', orderController.assignOrderManually);

router.patch('/auto-assign/:orderId', orderController.autoAssignDeliveryBoyWithin5km);

// router.post('/createDummy/:userId', orderController.seedDummyOrder); // seedDummyOrder is commented out in controller

 //--------

 router.get('/generateInvoice/:orderId', protect, orderController.generateInvoice);

 router.get('/getOrderById/:orderId', protect, orderController.getOrderById);

 router.post('/send-invoice/:orderId', protect, orderController.sendInvoiceByEmail);



module.exports = router;