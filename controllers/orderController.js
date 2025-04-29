const Order = require('../models/Order');
const Cart = require('../models/Cart');
const { Product } = require('../models/Product');
const CustomerAddress = require('../models/CustomerAddress');
const DeliveryBoy = require('../models/DeliveryBoy');
const mongoose = require('mongoose');

exports.createOrder = async (req, res) => {
  try {
    const userId = req.params.userId;
    const { deliveryAddressId, availableCoupon, offers, discount, deliverycharge, addressType } = req.body;

    if (!userId || !deliveryAddressId) {
      return res.status(400).json({
        message: 'UserId and DeliveryAddressId are required',
        success: false,
        data: []
      });
    }

    // 1️⃣ Fetch Cart
    const cart = await Cart.findOne({ userId });
    if (!cart || cart.cartProduct.length === 0) {
      return res.status(400).json({
        message: 'Cart is empty',
        success: false,
        data: []
      });
    }

    // 2️⃣ Fetch Address
    const customerAddress = await CustomerAddress.findOne(
      { "customerAddress._id": deliveryAddressId },
      { "customerAddress.$": 1 }
    );

    if (!customerAddress || customerAddress.customerAddress.length === 0) {
      return res.status(404).json({
        message: 'Delivery Address not found',
        success: false,
        data: []
      });
    }

    const address = customerAddress.customerAddress[0];

    // 3️⃣ Fetch ShopId from Product
    const firstProductId = cart.cartProduct[0];
    const productData = await Product.findOne({ "products._id": firstProductId });

    if (!productData) {
      return res.status(404).json({
        message: 'Product not found to fetch ShopId',
        success: false,
        data: []
      });
    }

    const shopId = productData.shopId;

    // 4️⃣ Calculate Total Amount from Products

    let totalAmount = 0;

    for (const productId of cart.cartProduct) {
      const productDocument = await Product.findOne({ "products._id": productId });

      if (productDocument) {
        const productFound = productDocument.products.find(p => p._id.toString() === productId);
        if (productFound && productFound.price) {
          totalAmount += Number(productFound.price);
        }
      }
    }

    // 5️⃣ Apply Discount if any
    let finalAmount = totalAmount;
    if (discount && !isNaN(discount)) {
      finalAmount = finalAmount - Number(discount);
    }

    // 6️⃣ Create New Order
    const newOrder = new Order({
      userId,
      shopId,
      productId: cart.cartProduct,
      deliveryAddress: {
        name: address.name,
        email: address.email,
        flatNumber: address.flatNumber,
        contact: address.contact,
        area: address.area,
        place: address.place,
        default: address.default,
        addressType: address.addressType
      },
      availableCoupon,
      offers,
      totalAmount: finalAmount.toString(),
      discount,
      deliverycharge,
      addressType
    });

    await newOrder.save();

    // 7️⃣ Clear the Cart after Order Success
    cart.cartProduct = [];
    await cart.save();

    return res.status(201).json({
      message: 'Order placed successfully',
      success: true,
      data: newOrder
    });

  } catch (error) {
    console.error('Create Order Error:', error);
    res.status(500).json({
      message: 'Failed to create order',
      success: false,
      data: error.message
    });
  }
};

exports.viewMyOrders = async (req, res) => {
    try {
      const userId = req.params.userId;
  
      if (!userId) {
        return res.status(400).json({
          message: 'UserId is required',
          success: false,
          data: []
        });
      }
  
      const orders = await Order.find({ userId }).sort({ createdAt: -1 }); // Latest orders first
  
      if (!orders || orders.length === 0) {
        return res.status(404).json({
          message: 'No orders found',
          success: false,
          data: []
        });
      }
  
      return res.status(200).json({
        message: 'Orders fetched successfully',
        success: true,
        data: orders
      });
  
    } catch (error) {
      console.error('View Orders Error:', error);
      res.status(500).json({
        message: 'Failed to fetch orders',
        success: false,
        data: error.message
      });
    }
  };

  exports.getAllOrders = async (req, res) => {
    try {
      const {
        search,
        status,
        shopId,
        userId,
        deliveryBoyId,
        from,
        to,
        page = 1,
        limit = 10,
        sort = 'desc',
        sortBy = 'createdAt'
      } = req.query;
  
      let filter = {};
  
      if (search) {
        filter.$or = [
          { _id: search },
          { availableCoupon: { $regex: search, $options: 'i' } },
          { offers: { $regex: search, $options: 'i' } }
        ];
      }
  
      if (status) {
        filter.orderStatus = status;
      }
  
      if (shopId) {
        filter.shopId = shopId;
      }
  
      if (userId) {
        filter.userId = userId;
      }
  
      if (deliveryBoyId) {
        filter.assignedDeliveryBoy = deliveryBoyId;
      }
  
      if (from && to) {
        filter.createdAt = {
          $gte: new Date(from),
          $lte: new Date(to)
        };
      }
  
      const orders = await Order.find(filter)
        .sort({ [sortBy]: sort === 'asc' ? 1 : -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit));
  
      const total = await Order.countDocuments(filter);
  
      return res.status(200).json({
        message: 'Orders fetched successfully',
        success: true,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        data: orders
      });
  
    } catch (error) {
      console.error('Get Orders Error:', error);
      return res.status(500).json({
        message: 'Failed to fetch orders',
        success: false,
        data: error.message
      });
    }
  };

// 2. View Orders By Shop (Shop Admin)
exports.viewOrdersByShopAdmin = async (req, res) => {
  try {
    const {
      shopId
    } = req.params;

    const {
      search,
      userId,
      orderStatus,
      from,
      to,
      page = 1,
      limit = 10,
      sort = 'desc',
      sortBy = 'createdAt'
    } = req.query;

    if (!shopId) {
      return res.status(400).json({
        message: 'Shop ID is required',
        success: false,
      });
    }

    let filter = { shopId };

    if (search) {
      filter._id = { $regex: search, $options: 'i' };
    }
    if (userId) {
      filter.userId = userId;
    }
    if (orderStatus) {
      filter.orderStatus = orderStatus;
    }
    if (from && to) {
      filter.createdAt = {
        $gte: new Date(from),
        $lte: new Date(to)
      };
    }

    const orders = await Order.find(filter)
      .sort({ [sortBy]: sort === 'asc' ? 1 : -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Order.countDocuments(filter);

    return res.status(200).json({
      message: 'Shop orders fetched successfully',
      success: true,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      data: orders
    });

  } catch (error) {
    console.error('Shop Admin View Orders Error:', error);
    res.status(500).json({
      message: 'Failed to fetch shop orders',
      success: false,
      data: error.message
    });
  }
};


  exports.updateOrderStatus = async (req, res) => {
    try {
      const orderId = req.params.orderId;
      const { newStatus } = req.body;
  
      if (!orderId || !newStatus) {
        return res.status(400).json({
          message: 'OrderId and newStatus are required',
          success: false,
          data: []
        });
      }
  
      const updatedOrder = await Order.findByIdAndUpdate(
        orderId,
        { orderStatus: newStatus },
        { new: true }
      );
  
      if (!updatedOrder) {
        return res.status(404).json({
          message: 'Order not found',
          success: false,
          data: []
        });
      }
  
      return res.status(200).json({
        message: 'Order status updated successfully',
        success: true,
        data: updatedOrder
      });
  
    } catch (error) {
      console.error('Update Order Status Error:', error);
      res.status(500).json({
        message: 'Failed to update order status',
        success: false,
        data: error.message
      });
    }
  };


  exports.cancelOrder = async (req, res) => {
    try {
      const orderId = req.params.orderId;
      const { cancelReason } = req.body;
  
      if (!orderId) {
        return res.status(400).json({
          message: 'OrderId is required',
          success: false,
          data: []
        });
      }
  
      const updatedOrder = await Order.findByIdAndUpdate(
        orderId,
        { 
          orderStatus: 'Cancelled',
          cancelReason: cancelReason || "Cancelled by user/admin" 
        },
        { new: true }
      );
  
      if (!updatedOrder) {
        return res.status(404).json({
          message: 'Order not found',
          success: false,
          data: []
        });
      }
  
      return res.status(200).json({
        message: 'Order cancelled successfully',
        success: true,
        data: updatedOrder
      });
  
    } catch (error) {
      console.error('Cancel Order Error:', error);
      res.status(500).json({
        message: 'Failed to cancel order',
        success: false,
        data: error.message
      });
    }
  };


  exports.refundOrder = async (req, res) => {
    try {
      const orderId = req.params.orderId;
      const { refundAmount, refundReason } = req.body;
  
      if (!orderId) {
        return res.status(400).json({
          message: 'OrderId is required',
          success: false,
          data: []
        });
      }
  
      const updatedOrder = await Order.findByIdAndUpdate(
        orderId,
        { 
          orderStatus: 'Refunded',
          refundDetails: {
            refundAmount: refundAmount || "Full",
            refundReason: refundReason || "Default refund reason"
          }
        },
        { new: true }
      );
  
      if (!updatedOrder) {
        return res.status(404).json({
          message: 'Order not found',
          success: false,
          data: []
        });
      }
  
      return res.status(200).json({
        message: 'Order refunded successfully',
        success: true,
        data: updatedOrder
      });
  
    } catch (error) {
      console.error('Refund Order Error:', error);
      res.status(500).json({
        message: 'Failed to refund order',
        success: false,
        data: error.message
      });
    }
  };


  exports.deliveryBoyAcceptRejectOrder = async (req, res) => {
    try {
      const orderId = req.params.orderId;
      const { deliveryBoyId, action } = req.body; // action = 'accept' or 'reject'
  
      if (!orderId || !deliveryBoyId || !action) {
        return res.status(400).json({
          message: 'OrderId, DeliveryBoyId, and Action are required',
          success: false,
          data: []
        });
      }
  
      let updateFields = {};
  
      if (action === 'accept') {
        updateFields = {
          assignedDeliveryBoy: deliveryBoyId,
          orderStatus: 'Accepted by Delivery Boy'
        };
      } else if (action === 'reject') {
        updateFields = {
          assignedDeliveryBoy: null,
          orderStatus: 'Pending for Delivery Assignment'
        };
      } else {
        return res.status(400).json({
          message: 'Invalid action, must be accept or reject',
          success: false,
          data: []
        });
      }
  
      const updatedOrder = await Order.findByIdAndUpdate(
        orderId,
        updateFields,
        { new: true }
      );
  
      if (!updatedOrder) {
        return res.status(404).json({
          message: 'Order not found',
          success: false,
          data: []
        });
      }
  
      return res.status(200).json({
        message: `Order ${action}ed successfully`,
        success: true,
        data: updatedOrder
      });
  
    } catch (error) {
      console.error('Delivery Boy Accept/Reject Error:', error);
      res.status(500).json({
        message: 'Failed to process delivery boy action',
        success: false,
        data: error.message
      });
    }
  };


  exports.customerRaiseRefundRequest = async (req, res) => {
    try {
      const orderId = req.params.orderId;
      const { refundReason } = req.body;
  
      if (!orderId || !refundReason) {
        return res.status(400).json({
          message: 'OrderId and RefundReason are required',
          success: false,
          data: []
        });
      }
  
      const updatedOrder = await Order.findByIdAndUpdate(
        orderId,
        { 
          refundRequest: {
            requested: true,
            reason: refundReason,
            status: 'Pending'
          }
        },
        { new: true }
      );
  
      if (!updatedOrder) {
        return res.status(404).json({
          message: 'Order not found',
          success: false,
          data: []
        });
      }
  
      return res.status(200).json({
        message: 'Refund request raised successfully',
        success: true,
        data: updatedOrder
      });
  
    } catch (error) {
      console.error('Customer Refund Request Error:', error);
      res.status(500).json({
        message: 'Failed to raise refund request',
        success: false,
        data: error.message
      });
    }
  };


  exports.assignDeliveryBoy = async (req, res) => {
    try {
      const orderId = req.params.orderId;
      const { deliveryBoyId } = req.body;
  
      if (!orderId || !deliveryBoyId) {
        return res.status(400).json({
          message: 'OrderId and DeliveryBoyId are required',
          success: false,
          data: []
        });
      }
  
      const updatedOrder = await Order.findByIdAndUpdate(
        orderId,
        {
          assignedDeliveryBoy: deliveryBoyId,
          orderStatus: 'Delivery Boy Assigned'
        },
        { new: true }
      );
  
      if (!updatedOrder) {
        return res.status(404).json({
          message: 'Order not found',
          success: false,
          data: []
        });
      }
  
      return res.status(200).json({
        message: 'Delivery Boy assigned successfully',
        success: true,
        data: updatedOrder
      });
  
    } catch (error) {
      console.error('Assign Delivery Boy Error:', error);
      res.status(500).json({
        message: 'Failed to assign delivery boy',
        success: false,
        data: error.message
      });
    }
  };





// Helper function to calculate distance using Haversine Formula
function calculateDistance(lat1, lon1, lat2, lon2) {
  const toRad = (value) => (value * Math.PI) / 180;
  const R = 6371; // Radius of Earth in KM

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return distance; // Distance in KM
}



// Haversine formula function...

exports.autoAssignDeliveryBoyWithin5km = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const { shopLatitude, shopLongitude } = req.body;

    if (!orderId || shopLatitude === undefined || shopLongitude === undefined) {
      return res.status(400).json({
        message: 'OrderId, ShopLatitude, and ShopLongitude are required',
        success: false,
        data: []
      });
    }

    const deliveryBoys = await DeliveryBoy.find({ availability: true });

    if (deliveryBoys.length === 0) {
      return res.status(404).json({
        message: 'No delivery boys available',
        success: false,
        data: []
      });
    }

    const nearbyDeliveryBoys = deliveryBoys
      .map(boy => {
        const distance = calculateDistance(shopLatitude, shopLongitude, boy.latitude, boy.longitude);
        return { ...boy._doc, distance };
      })
      .filter(boy => boy.distance <= 5)
      .sort((a, b) => a.distance - b.distance);

    if (nearbyDeliveryBoys.length === 0) {
      return res.status(404).json({
        message: 'No delivery boy found within 5 km',
        success: false,
        data: []
      });
    }

    const nearestDeliveryBoy = nearbyDeliveryBoys[0];

    // 1️⃣ Check if order exists first
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        message: 'Order not found',
        success: false,
        data: []
      });
    }

    // 2️⃣ Now Properly Update Order
    order.assignedDeliveryBoy = new mongoose.Types.ObjectId(nearestDeliveryBoy._id);
    order.orderStatus = 'Delivery Boy Assigned';
    await order.save();

    return res.status(200).json({
      message: 'Nearest delivery boy assigned successfully',
      success: true,
      data: {
        assignedDeliveryBoy: nearestDeliveryBoy,
        order
      }
    });

  } catch (error) {
    console.error('Auto Assign Delivery Boy Error:', error);
    res.status(500).json({
      message: 'Failed to auto assign delivery boy',
      success: false,
      data: error.message
    });
  }
};


