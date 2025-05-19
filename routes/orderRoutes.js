const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { protect } = require('../middleware/authMiddleware');


router.post('/create/:userId', protect,orderController.createOrder);

router.get('/my-orders/:userId',protect ,orderController.viewMyOrders);

router.get('/all-orders', orderController.getAllOrders);

router.get('/shop-orders/:shopId', orderController.viewOrdersByShopAdmin);

router.put('/update-status/:orderId', orderController.updateOrderStatus);

router.put('/cancel/:orderId', orderController.cancelOrder);

router.put('/refund/:orderId', orderController.refundOrder);

router.put('/delivery-boy/accept-reject/:orderId', orderController.deliveryBoyAcceptRejectOrder);

router.put('/customer/refund-request/:orderId', orderController.customerRaiseRefundRequest);

router.put('/assign-delivery-boy', orderController.assignOrderManually);

router.patch('/auto-assign/:orderId', orderController.autoAssignDeliveryBoyWithin5km);





module.exports = router;