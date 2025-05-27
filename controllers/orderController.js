const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');

const DeliveryBoy = require('../models/DeliveryBoy');
const mongoose = require('mongoose');
const Stock = require('../models/Stock');
const axios = require('axios');
const CustomerAddress = require('../models/CustomerAddress');
const geolib = require('geolib');
const { Shop } = require('../models/Shop');


// Create Order and auto-reduce stock
const Coupon = require('../models/Coupon');
const Offer = require('../models/Offers');
const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const PER_KM_RATE = parseFloat(process.env.PER_KM_RATE) || 2; // AED per km




const getLatLngFromAddress = async (addressString) => {
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addressString)}&key=${GOOGLE_API_KEY}`;
    const response = await axios.get(url);

    if (
      response.data &&
      response.data.results &&
      response.data.results.length > 0
    ) {
      const location = response.data.results[0].geometry.location;
      return {
        latitude: location.lat,
        longitude: location.lng
      };
    }

    return null;
  } catch (err) {
    console.error('Geocode API Error:', err.message);
    return null;
  }
};




exports.createOrder = async (req, res) => {
  try {
    const { couponCode, paymentType } = req.body;
    const userId = req.user?._id || req.params.userId;
    if (!userId) return res.status(400).json({ message: 'User ID is required', success: false });
    console.log(userId);

    // Step 1: Fetch user address from User model
    const user = await require('../models/User').findById(userId);
    if (!user || !user.address || user.address.length === 0) {
      return res.status(400).json({ message: 'No delivery address found', success: false });
    }

    let deliveryAddress = user.address.find(a => a.default) || user.address[0];
    deliveryAddress = deliveryAddress?.toObject?.() || deliveryAddress;
    if (!deliveryAddress.address) {
      const matchingAddress = user.address.find(a => a._id?.toString() === deliveryAddress._id?.toString());
      if (matchingAddress && matchingAddress.address) {
        deliveryAddress.address = matchingAddress.address;
      }
    }

    // Step 2: Fetch cart and products
    const cart = await Cart.findOne({ userId });
    if (!cart || cart.cartProduct.length === 0)
      return res.status(400).json({ message: 'Cart is empty', success: false });

    const productIds = cart.cartProduct;
    const productDocs = await Product.find({ _id: { $in: productIds } });

    const allProducts = productDocs;
    const shopId = allProducts[0]?.shopId || null;
    if (!shopId) return res.status(400).json({ message: 'No valid shopId found', success: false });

    // Calculate original total from nested part prices
    let originalTotal = 0;
    for (const product of allProducts) {
      for (const category of product.subCategories || []) {
        for (const part of category.parts || []) {
          originalTotal += part.discountedPrice || part.price || 0;
        }
      }
    }

    // Step 3: Calculate offers

    // Step 4: Apply coupon
    const priceAfterOffers = originalTotal;
    let couponDiscount = 0, appliedCoupon = null;
    if (couponCode) {
      const coupon = await Coupon.findOne({ code: couponCode, isActive: true });
      if (!coupon) return res.status(400).json({ message: 'Invalid coupon', success: false });
      if (new Date() > coupon.expiryDate) return res.status(400).json({ message: 'Coupon expired', success: false });
      if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit)
        return res.status(400).json({ message: 'Coupon usage limit reached', success: false });

      if (coupon.minOrderAmount && priceAfterOffers < coupon.minOrderAmount) {
        console.warn(`Coupon minimum order not met: Required ₹${coupon.minOrderAmount}, but got ₹${priceAfterOffers}`);
        return res.status(400).json({
          message: `Coupon code requires minimum order of ₹${coupon.minOrderAmount}, but current order is ₹${priceAfterOffers}`,
          success: false
        });
      }

      couponDiscount = coupon.discountType === 'percent'
        ? (priceAfterOffers * coupon.discountValue) / 100
        : coupon.discountValue;

      appliedCoupon = {
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue
      };

      coupon.usedCount += 1;
      await coupon.save();
    }

    const totalDiscount = couponDiscount;
    const totalAmount = +(originalTotal - totalDiscount).toFixed(2);
    const deliverycharge = originalTotal < 500;
    const savings = totalDiscount;
    const finalPayable = totalAmount;

    // Step 5: Get user lat/lng if missing
    if (!deliveryAddress.latitude || !deliveryAddress.longitude) {
      const fullAddress = `${deliveryAddress.flatNumber}, ${deliveryAddress.area}, ${deliveryAddress.place}`;
      const coords = await getLatLngFromAddress(fullAddress);
      if (coords) {
        deliveryAddress.latitude = coords.latitude;
        deliveryAddress.longitude = coords.longitude;
      }
    }

    // Step 6: Calculate distance & earning
    const shop = await Shop.findOne({ _id: shopId });
    const shopLatLng = shop?.shopeDetails?.shopLocation?.split(',').map(Number);
    let deliveryDistance = 0;
    let deliveryEarning = 0;
    if (shopLatLng?.length === 2 && deliveryAddress.latitude && deliveryAddress.longitude) {
      deliveryDistance = geolib.getDistance(
        { latitude: shopLatLng[0], longitude: shopLatLng[1] },
        { latitude: deliveryAddress.latitude, longitude: deliveryAddress.longitude }
      ) / 1000;
      deliveryEarning = +(PER_KM_RATE * deliveryDistance).toFixed(2);
    }

     // Step 7.0: Reduce Stock
     for (const pid of productIds) {
      await Stock.findOneAndUpdate(
        { shopId, productId: pid },
        { $inc: { quantity: -1 } }, // assuming quantity 1 for simplicity
        { new: true }
      );
    }

    // io.emit('order_status_changed', {
    //   orderId: updatedOrder._id,
    //   status: updatedOrder.orderStatus,
    // });

    // Step 7: Save order
    const newOrder = new Order({
      userId,
      shopId,
      productId: productIds,
      deliveryAddress,
      totalAmount,
      discount: totalDiscount,
      deliverycharge,
      couponCode,
      appliedCoupon,
      orderStatus: 'Pending',
      refundRequest: { requested: false, status: 'Pending' },
      deliveryDistance,
      deliveryEarning,
      paymentType,
      additionalcharges: 0,
    });

    await newOrder.save();
    // 🔔 Emit socket event to all connected clients (shopId-based filtering on frontend)
    let io;
    try {
      io = require('../sockets/socket').getIO();
      io.emit('newOrder', {
        shopId: shopId.toString(),
        order: newOrder,
         shopDetails,
      });
    } catch (err) {
      console.error('Socket.IO emit failed:', err.message);
    }

    // Step 8: Clear cart
    cart.cartProduct = [];
    await cart.save();

    // Step 9: Respond
    // Fetch full shop details before returning response
    const shopDetails = await Shop.findById(shopId).lean();
    return res.status(201).json({
      message: 'Order placed successfully',
      success: true,
      data: {
        orderId: newOrder._id,
        originalTotal,
        discount: totalDiscount,
        totalAmount,
        finalPayable,
        deliverycharge,
        savings,
        deliveryDistance,
        deliveryEarning,
        appliedCoupon,
        deliveryAddress,
        items: productIds.length,
        products: allProducts,
        additionalcharges: 0,
        paymentType,
        shopDetails,
      }
    });

  } catch (err) {
    console.error('Create Order Error:', err);
    res.status(500).json({
      message: 'Failed to place order',
      success: false,
      data: err.message
    });
  }
};

// Create Order From Direct Buy API Handler
exports.createOrderFromDirectBuy = async (req, res) => {
  try {
    const { productIds, couponCode, paymentType, userId: bodyUserId } = req.body;
    const userId = bodyUserId || req.params.userId || req.user?._id;
    if (!userId || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ message: 'User ID and productIds are required', success: false });
    }

    // Fetch user and address
    const user = await require('../models/User').findById(userId);
    if (!user || !user.address || user.address.length === 0) {
      return res.status(400).json({ message: 'No delivery address found', success: false });
    }

    let deliveryAddress = user.address.find(a => a.default) || user.address[0];
    deliveryAddress = deliveryAddress?.toObject?.() || deliveryAddress;
    if (!deliveryAddress.address) {
      const matchingAddress = user.address.find(a => a._id?.toString() === deliveryAddress._id?.toString());
      if (matchingAddress && matchingAddress.address) {
        deliveryAddress.address = matchingAddress.address;
      }
    }

    // Fetch products
    const productDocs = await Product.find({ 'products._id': { $in: productIds } });
    const allProducts = productDocs.flatMap(shop =>
      shop.products.filter(p => productIds.includes(p._id.toString()))
    );
    const shopId = productDocs[0]?.shopId || null;
    if (!shopId) return res.status(400).json({ message: 'No valid shopId found', success: false });

    // Calculate offers
    let originalTotal = 0, totalOfferDiscount = 0, appliedOffers = [];
    for (const product of allProducts) {
      const price = product.price;
      originalTotal += price;

      const offer = await Offer.findOne({
        productIds: { $in: [product._id] },
        isActive: true,
        startDate: { $lte: new Date() },
        endDate: { $gte: new Date() }
      });

      if (offer) {
        const offerDiscount = offer.discountType === 'percent'
          ? (price * offer.discountValue) / 100
          : offer.discountValue;

        totalOfferDiscount += offerDiscount;
        appliedOffers.push({
          productId: product._id,
          name: product.name,
          discount: offerDiscount,
          offerId: offer._id,
          title: offer.title,
          type: offer.discountType,
          value: offer.discountValue
        });
      }
    }

    // Apply coupon
    const priceAfterOffers = originalTotal - totalOfferDiscount;
    let couponDiscount = 0, appliedCoupon = null;
    if (couponCode) {
      const coupon = await Coupon.findOne({ code: couponCode, isActive: true });
      if (!coupon) return res.status(400).json({ message: 'Invalid coupon', success: false });
      if (new Date() > coupon.expiryDate) return res.status(400).json({ message: 'Coupon expired', success: false });
      if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit)
        return res.status(400).json({ message: 'Coupon usage limit reached', success: false });

      if (coupon.minOrderAmount && priceAfterOffers < coupon.minOrderAmount)
        return res.status(400).json({ message: `Min order ₹${coupon.minOrderAmount} needed`, success: false });

      couponDiscount = coupon.discountType === 'percent'
        ? (priceAfterOffers * coupon.discountValue) / 100
        : coupon.discountValue;

      appliedCoupon = {
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue
      };

      coupon.usedCount += 1;
      await coupon.save();
    }

    const totalDiscount = totalOfferDiscount + couponDiscount;
    const totalAmount = originalTotal - totalDiscount;
    const deliverycharge = originalTotal < 500;
    const savings = totalDiscount;

    // Get user lat/lng if missing
    if (!deliveryAddress.latitude || !deliveryAddress.longitude) {
      const fullAddress = `${deliveryAddress.flatNumber}, ${deliveryAddress.area}, ${deliveryAddress.place}`;
      const coords = await getLatLngFromAddress(fullAddress);
      if (coords) {
        deliveryAddress.latitude = coords.latitude;
        deliveryAddress.longitude = coords.longitude;
      }
    }

    // Calculate distance & earning
    const shop = await Shop.findOne({ _id: shopId });
    const shopLatLng = shop?.shopeDetails?.shopLocation?.split(',').map(Number);
    let deliveryDistance = 0;
    let deliveryEarning = 0;
    if (shopLatLng?.length === 2 && deliveryAddress.latitude && deliveryAddress.longitude) {
      deliveryDistance = geolib.getDistance(
        { latitude: shopLatLng[0], longitude: shopLatLng[1] },
        { latitude: deliveryAddress.latitude, longitude: deliveryAddress.longitude }
      ) / 1000;
      deliveryEarning = +(PER_KM_RATE * deliveryDistance).toFixed(2);
    }

    // Reduce Stock
    for (const pid of productIds) {
      await Stock.findOneAndUpdate(
        { shopId, productId: pid },
        { $inc: { quantity: -1 } },
        { new: true }
      );
    }

    // Save order
    const newOrder = new Order({
      userId,
      shopId,
      productId: productIds,
      deliveryAddress,
      totalAmount,
      discount: totalDiscount,
      deliverycharge,
      couponCode,
      appliedCoupon,
      appliedOffers,
      orderStatus: 'Pending',
      refundRequest: { requested: false, status: 'Pending' },
      deliveryDistance,
      deliveryEarning,
      paymentType,
      additionalcharges: 0,
    });

    await newOrder.save();

    // Emit socket event to all connected clients (shopId-based filtering on frontend)
    let io;
    try {
      io = require('../sockets/socket').getIO();
      io.emit('newOrder', {
        shopId: shopId.toString(),
        order: newOrder
      });
    } catch (err) {
      console.error('Socket.IO emit failed:', err.message);
    }

    // Respond
    return res.status(201).json({
      message: 'Order placed successfully',
      success: true,
      data: {
        orderId: newOrder._id,
        originalTotal,
        discount: totalDiscount,
        totalAmount,
        finalPayable: totalAmount,
        deliverycharge,
        savings,
        deliveryDistance,
        deliveryEarning,
        appliedCoupon,
        appliedOffers,
        deliveryAddress,
        items: productIds.length,
        products: allProducts.map(p => ({
          id: p._id,
          name: p.name,
          price: p.price
        })),
        additionalcharges: 0,
        paymentType,
      }
    });

  } catch (err) {
    console.error('Create Direct Buy Order Error:', err);
    res.status(500).json({
      message: 'Failed to place direct buy order',
      success: false,
      data: err.message
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
      sortBy = 'createdAt',
      minAmount,
      maxAmount
    } = req.query;

    if (!shopId) {
      return res.status(400).json({
        message: 'Shop ID is required',
        success: false,
      });
    }

    let filter = { shopId };

    if (search) {
      if (mongoose.Types.ObjectId.isValid(search)) {
        filter._id = search;
      } else {
        // Optional: extend to other fields if needed
        filter['deliveryAddress.name'] = { $regex: search, $options: 'i' };
      }
    }
    if (userId) {
      filter.userId = userId;
    }
    if (orderStatus) {
      filter.orderStatus = new RegExp('^' + orderStatus + '$', 'i');
    }
    if (from && to) {
      const fromDate = new Date(from);
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999); // Ensure end of day is included
      filter.createdAt = {
        $gte: fromDate,
        $lte: toDate
      };
    }
    // Filter by minAmount and maxAmount
    if (minAmount || maxAmount) {
      filter.totalAmount = {};
      if (minAmount) filter.totalAmount.$gte = parseFloat(minAmount);
      if (maxAmount) filter.totalAmount.$lte = parseFloat(maxAmount);
    }

    // Fetch orders and include delivery boy details, and lean for easier manipulation
    const orders = await Order.find(filter)
      .populate('assignedDeliveryBoy', 'name email phone agencyAddress city')
      .sort({ [sortBy]: sort === 'asc' ? 1 : -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    // For each order, attach full product details
    for (let order of orders) {
      // Find products in all Product documents that match any of the order.productId
      // order.productId could be array of ObjectIds or strings
      const productDetails = await Product.find({ 'products._id': { $in: order.productId } });

      // Flatten and filter out the actual products that match
      order.fullProductDetails = productDetails.flatMap(shop =>
        shop.products.filter(p =>
          order.productId.map(id => id.toString()).includes(p._id.toString())
        )
      );
    }

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

    // 🔔 Emit real-time status update
    let io;
    try {
      io = require('../sockets/socket').getIO();
      io.emit('orderStatusUpdated', {
        shopId: updatedOrder.shopId.toString(),
        orderId: updatedOrder._id.toString(),
        newStatus: updatedOrder.orderStatus
      });
    } catch (err) {
      console.error('Socket.IO emit failed:', err.message);
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


  exports.assignOrderManually = async (req, res) => {
    try {
      const { orderId, deliveryBoyId } = req.body;
  
      const order = await Order.findById(orderId);
      if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
  
      const deliveryBoy = await DeliveryBoy.findById(deliveryBoyId);
      if (!deliveryBoy || !deliveryBoy.availability) {
        return res.status(400).json({ success: false, message: 'Invalid or unavailable delivery boy' });
      }
  
      order.assignedDeliveryBoy = deliveryBoyId;
      order.orderStatus = 'Delivery Boy Assigned';
      await order.save();
  
      return res.status(200).json({
        message: 'Order manually assigned to delivery boy',
        success: true,
        data: {
          orderId: order._id,
          deliveryBoy: deliveryBoy.name
        }
      });
  
    } catch (err) {
      res.status(500).json({
        message: 'Manual order assignment failed',
        success: false,
        data: err.message
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



exports.autoAssignDeliveryBoyWithin5km = async (req, res) => {
  try {
    console.log('🚀 API hit: autoAssignDeliveryBoyWithin5km');
    const orderId = req.params.orderId;

    // 1️⃣ Find order
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found', success: false, data: [] });
    }

    // 2️⃣ Fetch shop using order.shopId
    const shop = await Shop.findById(order.shopId);
    if (!shop || !shop.shopeDetails || !shop.shopeDetails.shopLocation) {
      return res.status(404).json({ message: 'Shop location not found', success: false, data: [] });
    }

    const [shopLatitude, shopLongitude] = shop.shopeDetails.shopLocation.split(',').map(Number);

    if (!shopLatitude || !shopLongitude) {
      return res.status(400).json({ message: 'Invalid shop location coordinates', success: false });
    }

    // 3️⃣ Fetch available delivery boys
    const deliveryBoys = await DeliveryBoy.find({ availability: true });

    // Get customer coordinates from order
    const customerLat = order.deliveryAddress.latitude;
    const customerLng = order.deliveryAddress.longitude;

    const nearbyDeliveryBoys = deliveryBoys
      .map(boy => {
        const pickupDistance = calculateDistance(shopLatitude, shopLongitude, boy.latitude, boy.longitude);
        const dropDistance = calculateDistance(shopLatitude, shopLongitude, customerLat, customerLng);
        // Estimated time: assume average speed of 30 km/h → time = distance / speed × 60
        const pickupTime = Math.ceil((pickupDistance / 30) * 60); // in minutes
        const dropTime = Math.ceil((dropDistance / 30) * 60); // in minutes
        return {
          ...boy._doc,
          pickupDistance: +pickupDistance.toFixed(2),
          dropDistance: +dropDistance.toFixed(2),
          pickupTime: `${pickupTime} mins`,
          dropTime: `${dropTime} mins`
        };
      })
      .filter(boy => boy.pickupDistance <= 5)
      .sort((a, b) => a.pickupDistance - b.pickupDistance);

    if (nearbyDeliveryBoys.length === 0) {
      return res.status(404).json({ message: 'No delivery boy found within 5 km', success: false });
    }

    // 4️⃣ Notify all nearby delivery boys
    // After selecting delivery boys, update order status before emitting events
    order.orderStatus = 'Delivery Boy Assigned';
    await order.save();
    let io;
    try {
      io = require('../sockets/socket').getIO();
      nearbyDeliveryBoys.forEach(boy => {
        const deliveryBoyId = boy._id.toString();
        console.log(`📢 Emitting to userId room: ${deliveryBoyId}`);
        console.log(`📦 Sending to deliveryBoyId: ${deliveryBoyId}`);
        io.to(deliveryBoyId).emit('new_order_assigned', {
          message: 'You have a new order to accept or reject',
          orderId: order._id.toString(),
          data: {
            nearbyDeliveryBoys,
            order,
            shop: {
              id: shop._id,
              name: shop.name,
              shopeDetails: shop.shopeDetails
            }
          }
        });
      });
    } catch (err) {
      console.error('Socket.IO emit failed:', err.message);
    }

    return res.status(200).json({
      message: 'Order assignment request sent to all nearby delivery boys',
      success: true,
      data: {
        nearbyDeliveryBoys,
      order,
        shop: {
          id: shop._id,
          name: shop.name,
          shopeDetails: shop.shopeDetails
        }
      }
    });

  } catch (error) {
    console.error('Auto Assign Delivery Boy Error:', error);
    return res.status(500).json({
      message: 'Failed to auto assign delivery boy',
      success: false,
      data: error.message
    });
  }
};

exports.seedDummyOrder = async (req, res) => {
  try {
    // Step 1: Create a dummy user ID
    const userId = new mongoose.Types.ObjectId();

    // Step 2: Create a dummy shop
    const shop = await Shop.create({
      name: 'Dummy Shop',
      shopeDetails: {
        shopLocation: '12.9352,77.6145'
      }
    });

    // Step 3: Add products to the shop
    const product = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Test Product',
      price: 200,
      image: 'https://via.placeholder.com/150'
    };

    const productDoc = await Product.create({
      shopId: shop._id,
      products: [product]
    });

    // Step 4: Add dummy stock for that product
    await Stock.create({
      shopId: shop._id,
      productId: product._id,
      quantity: 10
    });

    // Step 5: Add dummy address for the user
    await CustomerAddress.create({
      userId,
      customerAddress: [{
        name: 'John Doe',
        email: 'john@example.com',
        flatNumber: '123',
        contact: '9999999999',
        area: 'Koramangala',
        place: 'Bangalore',
        default: true,
        addressType: 'Home',
        latitude: 12.9376,
        longitude: 77.6192
      }]
    });

    // Step 6: Add product to the cart
    await Cart.create({
      userId,
      cartProduct: [product._id]
    });

    return res.status(201).json({
      message: 'Dummy user, shop, product, stock, address, and cart seeded successfully',
      success: true,
      data: {
        userId: userId,
        productId: product._id,
        shopId: shop._id
      }
    });

  } catch (error) {
    console.error('Dummy Order Seed Error:', error);
    return res.status(500).json({
      message: 'Failed to seed dummy order data',
      success: false,
      error: error.message
    });
  }
};

