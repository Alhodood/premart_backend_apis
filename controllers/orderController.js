const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Payment = require('../models/Payment');
const DeliveryBoy = require('../models/DeliveryBoy');
const mongoose = require('mongoose');
const Stock = require('../models/Stock');
const axios = require('axios');
const geolib = require('geolib');

const { Shop } = require('../models/Shop');
const MasterOrder = require('../models/MasterOrder');
const PDFDocument = require('pdfkit');


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
    const { couponCode, paymentType,transactionId } = req.body;
    // Ensure transactionId is destructured from req.body before payment creation
    
    const userId = req.user?._id || req.params.userId;
    if (!userId) return res.status(400).json({ message: 'User ID is required', success: false });
    console.log(userId);

    // Step 1: Fetch user address from User model and set deliveryAddress with fallback lat/lng
    const User = require('../models/User');
    const userData = await User.findById(userId);
    if (!userData || !userData.address || userData.address.length === 0) {
      return res.status(400).json({ message: 'No delivery address found', success: false });
    }
    const defaultAddress = userData?.address?.find(addr => addr.default);
    if (!defaultAddress) {
      return res.status(400).json({ message: 'No default delivery address found', success: false });
    }
    const deliveryAddress = {
      ...defaultAddress.toObject(),
      latitude: defaultAddress.latitude || userData.latitude,
      longitude: defaultAddress.longitude || userData.longitude
    };

    // Step 2: Fetch cart and products
    const cart = await Cart.findOne({ userId });
    if (!cart || cart.cartProduct.length === 0)
      return res.status(400).json({ message: 'Cart is empty', success: false });

    const cartItems = cart.cartProduct;
    const productIds = cartItems.map(item => item.productId);
    const productDocs = await Product.find({ _id: { $in: productIds } });

    // Map productId to quantity from cart
    const productQuantities = {};
    cartItems.forEach(item => {
      productQuantities[item.productId.toString()] = item.quantity;
    });

    // Attach quantity to each product
    const allProducts = productDocs.map(prod => {
      const quantity = productQuantities[prod._id.toString()] || 1;
      return { ...prod.toObject(), quantity };
    });

    // --- Group products by shopId ---
    const productsByShop = {};
    for (const prod of allProducts) {
      const sId = prod.shopId?.toString();
      if (!productsByShop[sId]) productsByShop[sId] = [];
      productsByShop[sId].push(prod);
    }

    // Calculate original total from nested part prices (all products)
    let originalTotal = 0;
    for (const product of allProducts) {
      for (const category of product.subCategories || []) {
        for (const part of category.parts || []) {
          const quantity = productQuantities[product._id.toString()] || 1;
          originalTotal += quantity * (part.discountedPrice || part.price || 0);
        }
      }
    }

    // Step 3: Calculate offers (TODO: Per shop? Not implemented here)

    // Step 4: Apply coupon (applies only once to whole order, not per shop)
    const priceAfterOffers = originalTotal;
    let couponDiscount = 0, appliedCoupon = null;
    if (couponCode) {
      const coupon = await Coupon.findOne({ code: couponCode, isActive: true });
      if (!coupon) return res.status(400).json({ message: 'Invalid coupon', success: false });
      const currentUserUsage = coupon.userId?.filter(id => id.toString() === userId.toString()).length || 0;
      if (new Date() > coupon.expiryDate) return res.status(400).json({ message: 'Coupon expired', success: false });
      if (coupon.usageLimit && currentUserUsage >= coupon.usageLimit)
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
      coupon.userId.push(userId);
      await coupon.save();
    }

    const totalDiscount = couponDiscount;
    const totalAmount = +(originalTotal - totalDiscount).toFixed(2);
    // Delivery charge logic: true for each order if master cart < 500, else false
    const deliverycharge = originalTotal < 500;
    const savings = totalDiscount;
    let masterDeliveryCharge = 0;
    if (originalTotal < 500) {
      masterDeliveryCharge = 30;
    }
    // Update finalPayable to include master delivery charge
    const finalPayable = totalAmount + masterDeliveryCharge;

    // Step 5: Get user lat/lng if missing
    if (!deliveryAddress.latitude || !deliveryAddress.longitude) {
      const fullAddress = `${deliveryAddress.flatNumber}, ${deliveryAddress.area}, ${deliveryAddress.place}`;
      const coords = await getLatLngFromAddress(fullAddress);
      if (coords) {
        deliveryAddress.latitude = coords.latitude;
        deliveryAddress.longitude = coords.longitude;
      }
    }

    // --- Step 6: Per-shop order creation, parallelized ---
    const shopIds = Object.keys(productsByShop);

    // --- Create MasterOrder first so its _id is available ---
    // We'll create an empty MasterOrder and update it after collecting orderIds
    const masterOrder = new MasterOrder({
      userId,
      orderIds: [], // will update after per-shop orders
      totalAmount: originalTotal,
      // Set deliverycharge as 30 if total < 500, else 0
      deliverycharge: masterDeliveryCharge,
      finalPayable: finalPayable,
      couponApplied: appliedCoupon ? {
        code: appliedCoupon.code,
        discountType: appliedCoupon.discountType,
        discountValue: appliedCoupon.discountValue,
        discountAmount: totalDiscount
      } : null
    });
    await masterOrder.save();

    // Helper for per-shop order creation
    async function processShopOrder(shopId, shopProducts) {
      // Calculate per-shop total
      let shopOriginalTotal = 0;
      for (const product of shopProducts) {
        for (const category of product.subCategories || []) {
          for (const part of category.parts || []) {
            const quantity = productQuantities[product._id.toString()] || 1;
            shopOriginalTotal += quantity * (part.discountedPrice || part.price || 0);
          }
        }
      }

      // Calculate delivery distance/earning
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

      // Batch update stock for all products in this shop
      const stockUpdates = shopProducts.map(prod => {
        const quantityObj = cart.cartProduct.find(p => p.productId.toString() === prod._id.toString());
        const quantityToReduce = quantityObj?.quantity || 1;
        return Stock.findOneAndUpdate(
          { shopId, productId: prod._id },
          { $inc: { quantity: -quantityToReduce } },
          { new: true }
        );
      });
      await Promise.all(stockUpdates);

      // Calculate per-shop coupon discount (proportionally to shop's products)
      let totalCouponDiscount = 0;
      if (couponDiscount > 0 && allProducts.length > 0) {
        // Calculate shop subtotal (again, for coupon split)
        let shopSubtotal = 0;
        for (const product of shopProducts) {
          for (const category of product.subCategories || []) {
            for (const part of category.parts || []) {
              const quantity = productQuantities[product._id.toString()] || 1;
              shopSubtotal += quantity * (part.discountedPrice || part.price || 0);
            }
          }
        }
        totalCouponDiscount = +(couponDiscount * (shopSubtotal / originalTotal)).toFixed(2);
      }

      // Save order for this shop, and include masterOrderId
      const createdOrder = new Order({
        userId,
        shopId,
        productId: shopProducts.map(p => ({
          productId: p._id,
          quantity: productQuantities[p._id.toString()] || 1
        })),
        products: shopProducts.map(p => p.toObject ? p.toObject() : p),
        shopDetails: shop?.shopeDetails || {},
        deliveryAddress, // uses the new logic above
        totalAmount: shopOriginalTotal,
        finalPayable: (shopOriginalTotal - (totalCouponDiscount || 0)),
        // Delivery charge per order: boolean: true if masterDeliveryCharge > 0, else false
        deliverycharge: masterDeliveryCharge > 0,
        couponCode,
        appliedCoupon,
        transactionId: transactionId || null,
        orderStatus: 'Pending',
        orderStatusList: [{ status: 'Pending', date: new Date() }],
        refundRequest: { requested: false, status: 'Pending' },
        deliveryDistance,
        deliveryEarning,
        paymentType,
        additionalcharges: 0,
        masterOrderId: masterOrder._id,
      });
      // Debug log for deliverycharge
      console.log(`Order for shop ${shopId} deliverycharge:`, originalTotal < 500);
      await createdOrder.save();

      // Push order to shop.orders[]
      const shopPushPromise = Shop.findByIdAndUpdate(shopId, {
        $push: {
          orders: {
            orderId: createdOrder._id
          }
        }
      });

      // Emit socket event per shop
      let io;
      try {
        io = require('../sockets/socket').getIO();
        io.emit('newOrder', {
          shopId: shopId.toString(),
          order: createdOrder,
          shopDetails: shop?.shopeDetails || {},
        });
      } catch (err) {
        console.error('Socket.IO emit failed:', err.message);
      }

      // Wait for shopPushPromise to finish
      await shopPushPromise;

      return {
        createdOrder,
        shopId,
        shopDetails: shop,
        deliveryDistance,
        deliveryEarning,
        shopOriginalTotal,
        productCount: shopProducts.length
      };
    }

    // Parallelize per-shop order creation
    const perShopOrderPromises = shopIds.map(shopId =>
      processShopOrder(shopId, productsByShop[shopId])
    );
    const perShopResults = await Promise.all(perShopOrderPromises);

    const allOrderIds = perShopResults.map(r => r.createdOrder._id);
    const perShopOrderInfo = perShopResults.map(r => ({
      order: r.createdOrder,
      shopId: r.shopId,
      shopDetails: r.shopDetails,
      deliveryDistance: r.deliveryDistance,
      deliveryEarning: r.deliveryEarning,
      shopOriginalTotal: r.shopOriginalTotal,
      productCount: r.productCount
    }));

    // Update masterOrder with orderIds
    masterOrder.orderIds = allOrderIds;
    await masterOrder.save();

    // Step 8: Clear cart using batch update
    await Cart.updateOne({ userId }, { $set: { cartProduct: [] } });

    // 🔐 Create payment after order is saved successfully
    if (paymentType !== 'COD') {
      // For each shop, create a separate Payment document
      for (const result of perShopResults) {
        const payment = new Payment({
          orderId: result.createdOrder._id,
          userId,
          shopId: result.shopId,
          amount: result.createdOrder.finalPayable,
          paymentMethod: paymentType,
          transactionId: transactionId || null,
          paymentStatus: 'Paid'
        });
        await payment.save();
      }
    }

    // Step 9: Respond
    return res.status(201).json({
      message: 'Order placed successfully',
      success: true,
      data: {
        orderIds: allOrderIds,
        originalTotal,
        discount: totalDiscount,
        totalAmount,
        finalPayable,
        deliverycharge, // boolean: per order, true if < 500, else false
        masterDeliveryCharge,
        savings,
        perShopOrderInfo,
        appliedCoupon,
        deliveryAddress,
        items: allProducts.length,
        products: allProducts,
        additionalcharges: 0,
        paymentType,
        masterOrderId: masterOrder._id
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
    // Accept productId, quantity, transactionId, paymentType from req.body
    const { productId, quantity = 1, transactionId = null, paymentType, couponCode } = req.body;
    // Accept delivery address from request body
    const { deliveryAddress } = req.body;
    if (!deliveryAddress || !deliveryAddress.name || !deliveryAddress.address) {
      return res.status(400).json({ message: 'Delivery address is required in body', success: false });
    }
    // Ensure required fields for deliveryAddress schema
    deliveryAddress.default = deliveryAddress.default !== undefined ? deliveryAddress.default : false;
    deliveryAddress.addressType = deliveryAddress.addressType || 'Home';
    // Make latitude & longitude optional
    deliveryAddress.latitude  = deliveryAddress.latitude  !== undefined ? deliveryAddress.latitude  : null;
    deliveryAddress.longitude = deliveryAddress.longitude !== undefined ? deliveryAddress.longitude : null;
    // Accept userId from params or req.user
    const userId = req.params.userId || req.user?._id;
    if (!userId || !productId) {
      return res.status(400).json({ message: 'Missing userId or productId', success: false });
    }
    // Fetch product
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(400).json({ message: 'Product not found', success: false });
    }
    // Shop
    const shopId = product.shopId.toString();
    const shop = await Shop.findOne({ _id: shopId });
    // Calculate total for product (with all subcategories/parts)
    let productTotal = 0;
    for (const category of product.subCategories || []) {
      for (const part of category.parts || []) {
        productTotal += (part.discountedPrice || part.price || 0) * quantity;
      }
    }
    // Apply coupon
    let couponDiscount = 0, appliedCoupon = null;
    if (couponCode) {
      const coupon = await Coupon.findOne({ code: couponCode, isActive: true });
      if (coupon && new Date() <= coupon.expiryDate && (!coupon.usageLimit || coupon.usedCount < coupon.usageLimit)) {
        if (!coupon.minOrderAmount || productTotal >= coupon.minOrderAmount) {
          couponDiscount = coupon.discountType === 'percent'
            ? (productTotal * coupon.discountValue) / 100
            : coupon.discountValue;
          appliedCoupon = {
            code: coupon.code,
            discountType: coupon.discountType,
            discountValue: coupon.discountValue
          };
          coupon.usedCount += 1;
          await coupon.save();
        }
      }
    }
    const originalTotal = productTotal;
    const totalDiscount = couponDiscount;
    const totalAmount = +(originalTotal - totalDiscount).toFixed(2);
    const finalPayable = totalAmount;
    const deliverycharge = productTotal < 500;
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
    // Update stock for this product
    await Stock.findOneAndUpdate(
      { shopId, productId: product._id },
      { $inc: { quantity: -quantity } },
      { new: true }
    );
    // Create order
    // First create masterOrder so we can use its _id
    const masterOrder = new MasterOrder({
      userId,
      orderIds: [], // will update after order save
      totalAmount: originalTotal,
      finalPayable: finalPayable,
      couponApplied: appliedCoupon ? {
        code: appliedCoupon.code,
        discountType: appliedCoupon.discountType,
        discountValue: appliedCoupon.discountValue,
        discountAmount: totalDiscount
      } : null
    });
    await masterOrder.save();
    const order = new Order({
      userId,
      shopId,
      productId: [{ productId, quantity }],
      products: [product.toObject ? product.toObject() : product],
      deliveryAddress,
      totalAmount: productTotal,
      finalPayable,
      // deliverycharge is boolean: true if productTotal < 500, else false
      deliverycharge: productTotal < 500,
      couponCode,
      appliedCoupon,
      orderStatus: 'Pending',
      orderStatusList: [{ status: 'Pending', date: new Date() }],
      refundRequest: { requested: false, status: 'Pending' },
      deliveryDistance,
      deliveryEarning,
      paymentType,
      additionalcharges: 0,
      transactionId: transactionId || null,
      masterOrderId: masterOrder._id,
    });
    await order.save();
    // Update masterOrder with orderId
    masterOrder.orderIds = [order._id];
    await masterOrder.save();
    await Shop.findByIdAndUpdate(shopId, {
      $push: {
        orders: {
          orderId: order._id
        }
      }
    });
    if (paymentType !== 'COD') {
      const payment = new Payment({
        orderId: order._id,
        userId,
        shopId: shop._id,
        amount: finalPayable,
        paymentMethod: paymentType,
        transactionId: transactionId || null,
        paymentStatus: 'Paid'
      });
      await payment.save();
    }
    return res.status(201).json({
      message: 'Order placed successfully',
      success: true,
      data: {
        orderId: order._id,
        masterOrderId: masterOrder._id,
        originalTotal,
        discount: totalDiscount,
        totalAmount,
        finalPayable,
        deliverycharge,
        appliedCoupon,
        deliveryAddress,
        products: [product],
        additionalcharges: 0,
        paymentType
      }
    });
  } catch (err) {
    console.error('Create Direct Order Error:', err);
    res.status(500).json({
      message: 'Failed to place direct order',
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

    // Map orders to transform productId and products arrays into single objects
    const modifiedOrders = orders.map(order => {
      return {
        ...order.toObject(),
        productId: order.productId && order.productId.length > 0 ? order.productId[0] : null,
        products: order.products && order.products.length > 0 ? order.products[0] : null
      };
    });

    return res.status(200).json({
      message: 'Orders fetched successfully',
      success: true,
      data: modifiedOrders
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
    const { shopId } = req.params;
    const { page = 1, limit = 10, sort = 'desc', sortBy = 'createdAt' } = req.query;

    if (!shopId) {
      return res.status(400).json({
        message: 'Shop ID is required',
        success: false
      });
    }

    const orders = await Order.find({ shopId })
      .sort({ [sortBy]: sort === 'asc' ? 1 : -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const mappedOrders = orders.map(order => {
      const delivery = order.deliveryAddress || {};
      const productObj = order.productId && order.productId.length > 0 ? order.productId[0] : {};
      const fullProd = order.products && order.products.length > 0 ? order.products[0] : {};
      const subCat = fullProd.subCategories && fullProd.subCategories.length > 0 ? fullProd.subCategories[0] : {};
      const part = subCat.parts && subCat.parts.length > 0 ? subCat.parts[0] : {};

      return {
        _id: order._id,
        userId: order.userId,
        productId: productObj.productId,
        quantity: productObj.quantity,
        name: delivery.name,
        contact: delivery.contact,
        area: delivery.area,
        couponCode: order.couponCode,
        brand: fullProd.brand,
        year: fullProd.year,
        model: fullProd.model,
        frameCode: fullProd.frameCode,
        region: fullProd.region,
        categoryTab: subCat.categoryTab,
        subCategoryTab: subCat.subCategoryTab,
        partNumber: part.partNumber,
        partName: part.partName,
        imageUrl: part.imageUrl,
        totalAmount: order.totalAmount,
        finalPayable: order.finalPayable,
        deliverycharge: order.deliverycharge,
        paymentType: order.paymentType,
        orderStatus: order.orderStatus,
        createdAt: order.createdAt
      };
    });

    const total = await Order.countDocuments({ shopId });

    return res.status(200).json({
      message: 'Shop orders fetched successfully',
      success: true,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      data: mappedOrders
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

// Generate Invoice PDF (User or Shop)
exports.generateInvoice =  async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId)
      .populate('userId')
      .populate('shopId')
      .lean();

    if (!order) return res.status(404).json({ message: 'Order not found', success: false });

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    let buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      let pdfData = Buffer.concat(buffers);
      res.setHeader('Content-Disposition', `attachment; filename=Invoice_${order._id}.pdf`);
      res.contentType('application/pdf');
      res.send(pdfData);
    });

    // PDF Content
    doc.fontSize(20).text('INVOICE', { align: 'center' });
    doc.moveDown();

    doc.fontSize(12).text(`Invoice ID: ${order._id}`);
    doc.text(`Date: ${new Date(order.createdAt).toLocaleDateString()}`);
    doc.text(`Payment Type: ${order.paymentType}`);
    doc.moveDown();

    doc.text(`Customer: ${order.deliveryAddress.name}`);
    doc.text(`Contact: ${order.deliveryAddress.contact}`);
    doc.text(`Address: ${order.deliveryAddress.address}`);
    doc.moveDown();

    doc.text(`Shop: ${order.shopId?.shopeDetails?.shopName || 'N/A'}`);
    doc.text(`Shop Contact: ${order.shopId?.shopeDetails?.shopContact || 'N/A'}`);
    doc.moveDown();

    doc.fontSize(14).text('Products:', { underline: true });
    order.products.forEach((product, idx) => {
      product.subCategories?.forEach(cat => {
        cat.parts?.forEach(part => {
          doc.text(
            `${idx + 1}. ${part.partName} (${part.partNumber}) - Qty: ${part.quantity || 1} - Price: AED ${part.discountedPrice || part.price}`
          );
        });
      });
    });

    doc.moveDown();
    doc.fontSize(12).text(`Subtotal: AED ${order.totalAmount}`);
    if (order.appliedCoupon) {
      doc.text(`Coupon Applied: ${order.appliedCoupon.code}`);
      doc.text(`Discount: AED ${(parseFloat(order.totalAmount) - parseFloat(order.finalPayable)).toFixed(2)}`);
    }
    doc.text(`Total Payable: AED ${order.finalPayable}`);

    doc.end();
  } catch (err) {
    console.error('Invoice generation failed:', err);
    res.status(500).json({ message: 'Failed to generate invoice', success: false, data: err.message });
  }
}




// Get all pending orders
exports.getAllPendingOrders = async (req, res) => {
  try {
    const orders = await Order.find({ orderStatus: 'Pending' }).sort({ createdAt: -1 }).lean();
    // Map and flatten the required fields as per specification
    const mappedOrders = orders.map(order => {
      // Extract deliveryAddress fields
      const deliveryAddress = order.deliveryAddress || {};
      // Get first productId and quantity
      let productIdField = null, quantityField = null;
      if (Array.isArray(order.productId) && order.productId.length > 0) {
        productIdField = order.productId[0].productId || null;
        quantityField = order.productId[0].quantity || null;
      }
      // Get first product in products array
      let firstProduct = null;
      if (Array.isArray(order.products) && order.products.length > 0) {
        firstProduct = order.products[0];
      }
      // Get partName, partNumber from first part in first subCategory
      let partName = null, partNumber = null, brand = null, year = null, model = null, category = null;
      if (firstProduct && Array.isArray(firstProduct.subCategories) && firstProduct.subCategories.length > 0) {
        const firstSubCat = firstProduct.subCategories[0];
        if (Array.isArray(firstSubCat.parts) && firstSubCat.parts.length > 0) {
          const firstPart = firstSubCat.parts[0];
          partName = firstPart.partName || null;
          partNumber = firstPart.partNumber || null;
        }
        category = firstSubCat.categoryTab || null;
        // Get brand, year, model from parent product
        brand = firstProduct.brand || null;
        year = firstProduct.year || null;
        model = firstProduct.model || null;
      }
      return {
        _id: order._id,
        userId: order.userId,
        customer: deliveryAddress.name || null,
        contact: deliveryAddress.contact || null,
        Date:order.createdAt ,
        address: deliveryAddress.address || null,
        area: deliveryAddress.area || null,
        place: deliveryAddress.place || null,
        totalAmount: order.totalAmount,
        finalPayable: order.finalPayable,
        deliverycharge: order.deliverycharge,
        paymentType: order.paymentType,
        masterOrderId: order.masterOrderId,
        productId: productIdField,
        quantity: quantityField,
        product:partName,
        partNumber,
        brand,
        year,
        model,
        category
      };
    });
    res.status(200).json({
      success: true,
      message: "Pending orders fetched successfully",
      data: mappedOrders
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch pending orders",
      error: error.message
    });
  }
};