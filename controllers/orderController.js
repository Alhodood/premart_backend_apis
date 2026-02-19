const Order = require('../models/Order');
const Cart = require('../models/Cart');
const ShopProduct = require('../models/ShopProduct');
const PartsCatalog = require('../models/PartsCatalog');
const Payment = require('../models/Payment');
const DeliveryBoy = require('../models/DeliveryBoy');
const mongoose = require('mongoose');
const Stock = require('../models/Stock');
const axios = require('axios');
const geolib = require('geolib');
const path = require('path');
const fs = require('fs');

const { Shop } = require('../models/Shop');
const MasterOrder = require('../models/MasterOrder');
const PDFDocument = require('pdfkit');


// Create Order and auto-reduce stock
const Coupon = require('../models/Coupon');
const Offer = require('../models/Offers');
const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const { getSuperAdminSettings } = require('../helper/settingsHelper');
const { notifyUser, sendPushOnly } = require('../helper/notificationHelper');
const { sendOrderPlaced, sendOrderStatusUpdate, sendOrderCancelled, sendOrderInvoiceEmail } = require('../helper/mailHelper');

const { notifyNewOrder, notifyOrderStatusChange } = require('./bellNotifications');
const { sendOrderStatusEmail } = require('../services/emailService');


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
    // ✅ STEP 2: Get settings at start
    const settings = await getSuperAdminSettings();
    console.log('⚙️ Settings:', {
      perKmRate: settings.perKmRate,
      deliveryCharge: settings.deliveryCharge,
      freeDeliveryThreshold: settings.freeDeliveryThreshold
    });

    const { couponCode, paymentType, transactionId } = req.body;
    const userId = req.user?._id || req.params.userId;
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID required', success: false });
    }

    const User = require('../models/User');
    const userData = await User.findById(userId);
    if (!userData) {
      return res.status(400).json({ message: 'User not found', success: false });
    }

    let deliveryAddress = req.body.deliveryAddress;
    if (deliveryAddress?.name && deliveryAddress?.address) {
      deliveryAddress = {
        ...deliveryAddress,
        default: deliveryAddress.default ?? false,
        addressType: deliveryAddress.addressType || 'Home',
        latitude: deliveryAddress.latitude ?? userData.latitude ?? null,
        longitude: deliveryAddress.longitude ?? userData.longitude ?? null,
      };
    } else {
      const defaultAddress = userData.address?.find(a => a.default);
      if (!defaultAddress) {
        return res.status(400).json({ message: 'No delivery address', success: false });
      }
      deliveryAddress = {
        ...defaultAddress.toObject(),
        latitude: defaultAddress.latitude || userData.latitude,
        longitude: defaultAddress.longitude || userData.longitude,
      };
    }

    const cart = await Cart.findOne({ userId })
      .populate({
        path: 'items.shopProductId',
        populate: {
          path: 'part',
          populate: [
            { path: 'category', select: 'categoryName' },
            { path: 'subCategory', select: 'subCategoryName' },
            { 
              path: 'compatibleVehicleConfigs',
              populate: [
                { path: 'brand', select: 'brandName' },
                { path: 'model', select: 'modelName' }
              ]
            }
          ]
        }
      });

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: 'Cart is empty', success: false });
    }

    const allProducts = cart.items.map(item => ({
      shopProductId: item.shopProductId._id,
      shopId: item.shopProductId.shopId,
      originalPrice: item.shopProductId.price,
      discountedPrice: item.shopProductId.discountedPrice || null,
      price: item.shopProductId.discountedPrice || item.shopProductId.price,
      quantity: item.quantity,
      part: item.shopProductId.part
    }));

    const productsByShop = {};
    allProducts.forEach(p => {
      const sId = p.shopId.toString();
      if (!productsByShop[sId]) productsByShop[sId] = [];
      productsByShop[sId].push(p);
    });

    let originalTotal = 0;
    for (const p of allProducts) {
      originalTotal += p.price * p.quantity;
    }

    let couponDiscount = 0;
    let appliedCoupon = null;

    if (couponCode) {
      const coupon = await Coupon.findOne({ code: couponCode, isActive: true });
      if (!coupon) {
        return res.status(400).json({ message: 'Invalid coupon', success: false });
      }
      if (coupon.expiryDate && new Date() > coupon.expiryDate) {
        return res.status(400).json({ message: 'Coupon expired', success: false });
      }
      if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
        return res.status(400).json({ message: 'Coupon limit reached', success: false });
      }
      if (coupon.minOrderAmount && originalTotal < coupon.minOrderAmount) {
        return res.status(400).json({ message: `Minimum order: ${coupon.minOrderAmount}`, success: false });
      }

      if (coupon.discountType === 'percent') {
        couponDiscount = (originalTotal * coupon.discountValue) / 100;
      } else if (coupon.discountType === 'flat' || coupon.discountType === 'amount') {
        couponDiscount = coupon.discountValue;
      }

      appliedCoupon = {
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue
      };

      coupon.usedCount += 1;
      if (!coupon.userId) coupon.userId = [];
      coupon.userId.push(userId);
      await coupon.save();
    }

    const totalDiscount = couponDiscount;
    const totalAmount = +(originalTotal - totalDiscount).toFixed(2);
    
    // ✅ STEP 3: Use settings
    const deliverycharge = originalTotal < settings.freeDeliveryThreshold;
    const masterDeliveryCharge = deliverycharge ? settings.deliveryCharge : 0;
    const finalPayable = totalAmount + masterDeliveryCharge;

    const masterOrder = await MasterOrder.create({
      userId,
      totalAmount: originalTotal,
      finalPayable,
      deliverycharge: masterDeliveryCharge,
      couponApplied: appliedCoupon ? { ...appliedCoupon, discountAmount: totalDiscount } : null
    });

    const perShopResults = [];

    for (const shopId of Object.keys(productsByShop)) {
      const shop = await Shop.findById(shopId);
      const shopProducts = productsByShop[shopId];

      let shopTotal = 0;
      shopProducts.forEach(p => {
        shopTotal += p.price * p.quantity;
      });

      let shopDiscount = 0;
      if (couponDiscount > 0 && originalTotal > 0) {
        shopDiscount = +(couponDiscount * (shopTotal / originalTotal)).toFixed(2);
      }

      // ✅ STEP 4: Use settings for delivery
      const shopLatLng = shop?.shopeDetails?.shopLocation?.split(',').map(Number);
      let deliveryDistance = 0;
      let deliveryEarning = 0;

      if (shopLatLng?.length === 2 && deliveryAddress.latitude && deliveryAddress.longitude) {
        const shopLat = Number(shopLatLng[0]);
        const shopLng = Number(shopLatLng[1]);
        const deliveryLat = Number(deliveryAddress.latitude);
        const deliveryLng = Number(deliveryAddress.longitude);
        
        if (!isNaN(shopLat) && !isNaN(shopLng) && !isNaN(deliveryLat) && !isNaN(deliveryLng)) {
          const distanceInMeters = geolib.getDistance(
            { latitude: shopLat, longitude: shopLng },
            { latitude: deliveryLat, longitude: deliveryLng }
          );
          
          deliveryDistance = +(distanceInMeters / 1000).toFixed(2);
          deliveryEarning = +(settings.perKmRate * deliveryDistance).toFixed(2);
          
          console.log(`📍 Shop ${shopId}: ${deliveryDistance}km @ ${settings.perKmRate} AED/km = ${deliveryEarning} AED`);
        }
      }

      const shopDeliveryCharge = deliverycharge ? settings.deliveryCharge : 0;
      const shopFinalPayable = shopTotal - shopDiscount + shopDeliveryCharge;

      for (const p of shopProducts) {
        await ShopProduct.findByIdAndUpdate(p.shopProductId, { $inc: { stock: -p.quantity } });
      }

      const createdOrder = await Order.create({
        userId,
        shopId,
        masterOrderId: masterOrder._id,
         agencyId: null, 
        items: shopProducts.map(p => {
          const firstConfig = p.part.compatibleVehicleConfigs?.[0];
          return {
            shopProductId: p.shopProductId,
            quantity: p.quantity,
            snapshot: {
              partNumber: p.part.partNumber,
              partName: p.part.partName,
              brand: firstConfig?.brand || null,
              model: firstConfig?.model || null,
              category: p.part.category,
              price: p.originalPrice,
              discountedPrice: p.discountedPrice,
              image: p.part.images?.[0] || null
            }
          };
        }),
        deliveryAddress,
        subtotal: shopTotal,
        discount: shopDiscount,
        deliveryCharge: shopDeliveryCharge,
        totalPayable: shopFinalPayable,
        coupon: appliedCoupon ? {
          code: appliedCoupon.code,
          discountType: appliedCoupon.discountType,
          discountValue: appliedCoupon.discountValue,
          discountAmount: shopDiscount
        } : null,
        paymentType,
        transactionId: transactionId || null,
        deliveryDistance,
        deliveryEarning,
        status: 'Pending',
        statusHistory: [{ status: 'Pending', date: new Date() }]
      });

      await Shop.findByIdAndUpdate(shopId, { $push: { orders: { orderId: createdOrder._id } } });

      try {
  const socketModule = require('../sockets/socket');
  const orderData = {
    _id: createdOrder._id,
    customerName: createdOrder.deliveryAddress?.name || 'Customer',
    customerPhone: createdOrder.deliveryAddress?.contact || '-',
    orderStatus: createdOrder.status,
    productName: createdOrder.items[0]?.snapshot?.partName || 'Product',
    productImage: createdOrder.items[0]?.snapshot?.image || null,
    itemCount: createdOrder.items.length,
    quantity: createdOrder.items.reduce((sum, item) => sum + item.quantity, 0),
    totalAmount: createdOrder.subtotal,
    finalPayable: createdOrder.totalPayable,
    paymentMethod: createdOrder.paymentType,
    paymentStatus: createdOrder.paymentStatus,
    createdAt: createdOrder.createdAt,
    deliveryAddress: createdOrder.deliveryAddress,
    isNew: true
  };

  socketModule.emitToShop(shopId, 'new_order', orderData);
  socketModule.emitToSuperAdmins('new_order', { 
    ...orderData, 
    shopId, 
    shopName: shop?.shopeDetails?.shopName || 'Unknown' 
  });

  // ✅ ADD THIS: Send notification
  await notifyNewOrder(createdOrder, shop);
  
} catch (socketError) {
  console.error('Socket/Notification error:', socketError.message);
}

      perShopResults.push(createdOrder);
    }

    await MasterOrder.findByIdAndUpdate(masterOrder._id, { $set: { orderIds: perShopResults.map(o => o._id) } });
    await Cart.updateOne({ userId }, { $set: { items: [] } });

    const firstOrderId = perShopResults[0]?._id;
    if (userId && firstOrderId) {
      notifyUser(
        userId.toString(),
        'Order placed',
        `Your order has been placed successfully. Total: ${finalPayable}`,
        { route: 'order_details', order_id: String(firstOrderId) },
        'order'
      ).catch((e) => console.error('Notification failed:', e.message));
    }

    if (userData?.email) {
      const itemsSummary = perShopResults.length === 1
        ? `${perShopResults[0].items?.length || 0} item(s)`
        : `${perShopResults.length} shop(s), ${perShopResults.reduce((s, o) => s + (o.items?.length || 0), 0)} item(s)`;
      const orderIds = perShopResults.map(o => o._id);
      (async () => {
        try {
          const ordersWithShop = await Order.find({ _id: { $in: orderIds } }).populate('shopId').lean();
          const allShopsDetail = ordersWithShop.map((ord) => {
            const sd = ord.shopId?.shopeDetails || ord.shopId || {};
            const items = (ord.items || []).map((it) => {
              const snap = it.snapshot || {};
              const unitPrice = snap.discountedPrice != null ? snap.discountedPrice : snap.price || 0;
              const qty = it.quantity || 1;
              return {
                partName: snap.partName || 'Item',
                partNumber: snap.partNumber || '',
                qty,
                unitPrice,
                lineTotal: qty * unitPrice
              };
            });
            return {
              orderId: String(ord._id),
              shopName: sd.shopName || 'Shop',
              shopAddress: sd.shopAddress || '',
              shopContact: sd.shopContact || sd.shopMail || '',
              items,
              subtotal: ord.subtotal ?? 0,
              deliveryCharge: ord.deliveryCharge ?? 0,
              discount: ord.discount ?? 0,
              totalPayable: ord.totalPayable ?? 0
            };
          });
          const orderData = {
            orderId: String(firstOrderId),
            masterOrderId: ordersWithShop.length > 1 ? String(masterOrder._id) : undefined,
            totalPayable: finalPayable,
            itemsSummary,
            allShopsDetail: allShopsDetail.length > 0 ? allShopsDetail : undefined
          };
          let pdfBuffer = null;
          if (ordersWithShop.length === 1) {
            pdfBuffer = await getInvoicePdfBuffer(ordersWithShop[0]);
          } else if (ordersWithShop.length > 1) {
            pdfBuffer = await getInvoicePdfBufferForMasterOrder(ordersWithShop, {
              masterOrderId: String(masterOrder._id),
              grandTotal: finalPayable
            });
          }
          const r = await sendOrderPlaced(userData.email, userData.name, orderData, pdfBuffer);
          if (!r.sent) console.warn('Order placed email skipped:', r.error);
        } catch (e) {
          const orderData = { orderId: String(firstOrderId), totalPayable: finalPayable, itemsSummary };
          const r = await sendOrderPlaced(userData.email, userData.name, orderData, null).catch(() => ({}));
          if (!r?.sent) console.warn('Order placed email error:', e.message);
        }
      })();
    }

    return res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      data: {
        orderIds: perShopResults.map(o => o._id),
        originalTotal,
        totalAmount,
        finalPayable,
        deliverycharge: masterDeliveryCharge,
        appliedCoupon,
        masterOrderId: masterOrder._id
      }
    });

  } catch (err) {
    console.error('Create Order Error:', err);
    res.status(500).json({ message: 'Failed to place order', success: false, error: err.message });
  }
};




exports.getOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;
    console.log('📦 Fetching order:', orderId);

    const order = await Order.findById(orderId)
      .populate('userId', 'name email phone')
      .populate('shopId', 'shopName shopAddress contactNumber')
      .populate('assignedDeliveryBoy', 'name phoneNumber')
      .populate({
        path: 'items.shopProductId',
        select: 'price discountedPrice part',
        populate: {
          path: 'part',
          select: 'partName partNumber images category brand model'
        }
      })
      .lean();

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Enforce access: customer = own order only, shop admin = own shop, super admin = any
    // JWT payload has .id (not ._id); see authMiddleware + rbacAuthController generateToken
    const role = req.user?.role;
    const requestUserId = (req.user?.id ?? req.user?._id)?.toString();
    const requestShopId = req.user?.shopId?.toString();
    const orderUserId = order.userId?._id?.toString() || order.userId?.toString();
    const orderShopId = order.shopId?._id?.toString() || order.shopId?.toString();
    if (role === 'CUSTOMER' && orderUserId !== requestUserId) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this order'
      });
    }
    if (role === 'SHOP_ADMIN' && orderShopId !== requestShopId) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this order'
      });
    }

    console.log('✅ Order found:', order._id);
    console.log('📦 Order items:', JSON.stringify(order.items, null, 2));

    // Format response matching catalog API style (price, discountedPrice, finalPrice)
    const formattedOrder = {
      _id: order._id,
      createdAt: order.createdAt,

      // Status
      orderStatus: order.status || 'pending',
      statusHistory: order.statusHistory || [],

      // Financial fields
      totalAmount: order.subtotal || 0,
      finalPayable: order.totalPayable || 0,
      discount: order.discount || 0,
      deliveryChargeAmount: order.deliveryCharge || 0,
      deliverycharge: order.deliveryCharge > 0,
      deliveryEarning: order.deliveryEarning || 0,
      additionalcharges: 0,
      couponDiscount: order.coupon?.discountAmount || 0,

      // Quantity calculation
      quantity: order.items?.reduce((sum, item) => sum + (item.quantity || 1), 0) || 1,

      // Customer info
      deliveryAddress: order.deliveryAddress,
      customerName: order.deliveryAddress?.name || order.userId?.name || '-',
      customerPhone: order.deliveryAddress?.contact || order.userId?.phone || '-',

      // Payment
      paymentMethod: order.paymentType || 'Cash',
      paymentStatus: order.paymentStatus || 'Pending',
      transactionId: order.transactionId,

      // Shop info
      shopId: order.shopId,

      // Items - matching catalog format: price, discountedPrice, finalPrice
      items: order.items?.map(item => {
        const shopProduct = item.shopProductId;
        // For old orders: snapshot only has discounted price as "price" and discountedPrice is null
        // Use ShopProduct's original price as fallback
        const snapshotPrice = item.snapshot?.price || 0;
        const snapshotDiscounted = item.snapshot?.discountedPrice;
        const shopOriginalPrice = shopProduct?.price || 0;
        const shopDiscountedPrice = shopProduct?.discountedPrice;

        let price, discountedPrice;
        if (snapshotDiscounted != null) {
          // New order format: snapshot has both original and discounted
          price = snapshotPrice;
          discountedPrice = snapshotDiscounted;
        } else if (shopDiscountedPrice != null && shopOriginalPrice > snapshotPrice) {
          // Old order: snapshot.price is the discounted value, get original from ShopProduct
          price = shopOriginalPrice;
          discountedPrice = snapshotPrice;
        } else {
          // No discount at all
          price = shopOriginalPrice || snapshotPrice;
          discountedPrice = snapshotPrice;
        }

        const finalPrice = discountedPrice;
        const hasDiscount = price > discountedPrice;

        return {
          shopProductId: shopProduct?._id,
          quantity: item.quantity,
          partName: item.snapshot?.partName || shopProduct?.part?.partName || 'Product',
          partNumber: item.snapshot?.partNumber || shopProduct?.part?.partNumber,
          price: price,
          discountedPrice: discountedPrice,
          finalPrice: finalPrice,
          hasDiscount: hasDiscount,
          images: item.snapshot?.image
            ? [item.snapshot.image]
            : (shopProduct?.part?.images || []),
          snapshot: item.snapshot,
          brand: item.snapshot?.brand,
          model: item.snapshot?.model,
          category: item.snapshot?.category
        };
      }) || [],

      // Delivery boy
      assignedDeliveryBoy: order.assignedDeliveryBoy,

      // Coupon
      coupon: order.coupon
    };

    // Print all details of order and its status
    console.log('--- GET ORDER ---');
    console.log('orderId:', orderId);
    console.log('orderStatus:', formattedOrder.orderStatus);
    console.log('statusHistory:', JSON.stringify(formattedOrder.statusHistory, null, 2));
    console.log('paymentStatus:', formattedOrder.paymentStatus);
    console.log('paymentMethod:', formattedOrder.paymentMethod);
    console.log('totalAmount:', formattedOrder.totalAmount);
    console.log('finalPayable:', formattedOrder.finalPayable);
    console.log('customerName:', formattedOrder.customerName);
    console.log('customerPhone:', formattedOrder.customerPhone);
    console.log('deliveryAddress:', JSON.stringify(formattedOrder.deliveryAddress, null, 2));
    console.log('assignedDeliveryBoy:', JSON.stringify(formattedOrder.assignedDeliveryBoy, null, 2));
    console.log('items count:', formattedOrder.items?.length);
    console.log('full order data:', JSON.stringify(formattedOrder, null, 2));
    console.log('--- END GET ORDER ---');

    res.json({
      success: true,
      data: formattedOrder
    });
  } catch (err) {
    console.error('❌ Get Order Error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order',
      error: err.message
    });
  }
};

// Add this new controller function
exports.getAllCancelledOrders = async (req, res) => {
  try {
    const { 
      shopId,
      startDate,
      endDate 
    } = req.query;

    const filter = { 
      status: 'cancelled' // Filter only cancelled orders
    };

    if (shopId) filter.shopId = shopId;
    
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate('userId', 'name email phone')
        .populate('shopId', 'shopeDetails.shopName shopeDetails.shopAddress shopeDetails.EmiratesIdImage orders')
        .populate('assignedDeliveryBoy', 'name')
        .populate({
          path: 'items.shopProductId',
          populate: {
            path: 'part',
            select: 'partName images'
          }
        })
        .sort({ createdAt: -1 }) // Latest cancelled orders first
        .lean(),
      Order.countDocuments(filter)
    ]);

    // Format orders for table view
    const formattedOrders = orders.map(order => {
      const orderCount = order.shopId?.orders?.length || 0;

      return {
        _id: order._id,
        
        // Customer
        customerName: order.deliveryAddress?.name || order.userId?.name || '-',
        customerPhone: order.deliveryAddress?.contact || order.userId?.phone || '-',
        customerEmail: order.userId?.email || '-',
        
        // Status
        orderStatus: order.status || order.orderStatus || 'cancelled',
        cancellationReason: order.cancellationReason || 'Not specified',
        cancelledBy: order.cancelledBy || 'Unknown', // Could be 'customer', 'admin', 'shop'
        cancelledAt: order.cancelledAt || order.updatedAt,
        
        // First item details (for preview)
        productName: order.items?.[0]?.snapshot?.partName || 
                     order.items?.[0]?.shopProductId?.part?.partName || 
                     'Product',
        productImage: order.items?.[0]?.snapshot?.image || 
                      order.items?.[0]?.shopProductId?.part?.images?.[0] || 
                      null,
        itemCount: order.items?.length || 0,
        quantity: order.items?.reduce((sum, item) => sum + (item.quantity || 1), 0) || 1,
        
        // Dates
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        
        // Financial
        totalAmount: order.subtotal || order.totalAmount || 0,
        finalPayable: order.totalPayable || order.finalPayable || 0,
        refundAmount: order.refundAmount || 0,
        refundStatus: order.refundStatus || 'Pending',
        
        // Delivery
        deliveryAddress: order.deliveryAddress,
        deliveryBoy: order.assignedDeliveryBoy?.name || 'Not Assigned',
        
        // Shop
        shopName: order.shopId?.shopeDetails?.shopName || 'Unknown Shop',
        shopAddress: order.shopId?.shopeDetails?.shopAddress || '-',
        emiratesIdImage: order.shopId?.shopeDetails?.EmiratesIdImage || null,
        orderCount: orderCount,
        
        // Payment
        paymentMethod: order.paymentType || order.paymentMethod || 'Cash',
        paymentStatus: order.paymentStatus || 'Pending'
      };
    });

    res.json({
      success: true,
      data: formattedOrders,
      total: total,
      message: `Found ${total} cancelled orders`
    });

  } catch (err) {
    console.error('❌ Get Cancelled Orders Error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch cancelled orders',
      error: err.message
    });
  }
};



exports.getAllOrders = async (req, res) => {
  try {
    const {
      status,
      shopId,
      startDate,
      endDate
    } = req.query;

    const filter = {};

    if (status) filter.status = status;
    if (shopId) filter.shopId = shopId;

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate('userId', 'name email phone')
        .populate('shopId', 'shopeDetails.shopName shopeDetails.shopAddress shopeDetails.EmiratesIdImage orders')
        .populate({
          path: 'assignedDeliveryBoy',
          select: 'name phone agencyId',
          populate: {
            path: 'agencyId',
            select: 'agencyDetails.agencyName agencyDetails.agencyContact',
            model: 'DeliveryAgency'
          }
        })
        .populate({
          path: 'items.shopProductId',
          select: 'price discountedPrice part',
          populate: {
            path: 'part',
            select: 'partName images'
          }
        })
        .sort({ createdAt: 1 })
        .lean(),
      Order.countDocuments(filter)
    ]);

    // Helper: resolve price from snapshot + ShopProduct (handles old orders)
    const resolvePrice = (snapshot, shopProduct) => {
      const snapPrice = snapshot?.price || 0;
      const snapDisc = snapshot?.discountedPrice;
      const spPrice = shopProduct?.price || 0;
      const spDisc = shopProduct?.discountedPrice;

      if (snapDisc != null) {
        return { price: snapPrice, discountedPrice: snapDisc };
      }
      if (spDisc != null && spPrice > snapPrice) {
        return { price: spPrice, discountedPrice: snapPrice };
      }
      return { price: spPrice || snapPrice, discountedPrice: snapPrice };
    };

    const formattedOrders = orders.map(order => {
      const orderCount = order.shopId?.orders?.length || 0;
      const deliveryBoyName = order.assignedDeliveryBoy?.name || 'Not Assigned';
      const agencyName = order.assignedDeliveryBoy?.agencyId?.agencyDetails?.agencyName || '-';

      return {
        _id: order._id,
        customerName: order.deliveryAddress?.name || order.userId?.name || '-',
        customerPhone: order.deliveryAddress?.contact || order.userId?.phone || '-',
        orderStatus: order.status || order.orderStatus || 'pending',
        productName: order.items?.[0]?.snapshot?.partName ||
                     order.items?.[0]?.shopProductId?.part?.partName ||
                     'Product',
        productImage: order.items?.[0]?.snapshot?.image ||
                      order.items?.[0]?.shopProductId?.part?.images?.[0] ||
                      null,
        itemCount: order.items?.length || 0,
        quantity: order.items?.reduce((sum, item) => sum + (item.quantity || 1), 0) || 1,
        createdAt: order.createdAt,
        totalAmount: order.subtotal || order.totalAmount || 0,
        finalPayable: order.totalPayable || order.finalPayable || 0,
        discount: order.discount || 0,
        deliveryChargeAmount: order.deliveryCharge || 0,
        couponDiscount: order.coupon?.discountAmount || 0,

        items: order.items?.map(item => {
          const sp = item.shopProductId;
          const { price, discountedPrice } = resolvePrice(item.snapshot, sp);
          const finalPrice = discountedPrice;
          const hasDiscount = price > discountedPrice;

          return {
            shopProductId: sp?._id,
            quantity: item.quantity,
            partName: item.snapshot?.partName || sp?.part?.partName || 'Product',
            partNumber: item.snapshot?.partNumber,
            price,
            discountedPrice,
            finalPrice,
            hasDiscount,
            images: item.snapshot?.image
              ? [item.snapshot.image]
              : (sp?.part?.images || []),
            brand: item.snapshot?.brand,
            model: item.snapshot?.model,
            category: item.snapshot?.category
          };
        }) || [],

        deliveryAddress: order.deliveryAddress,
        deliveryBoy: deliveryBoyName,
        agencyName: agencyName,
        shopName: order.shopId?.shopeDetails?.shopName || 'Unknown Shop',
        shopAddress: order.shopId?.shopeDetails?.shopAddress || '-',
        emiratesIdImage: order.shopId?.shopeDetails?.EmiratesIdImage || null,
        orderCount: orderCount,
        paymentMethod: order.paymentType || order.paymentMethod || 'Cash',
        paymentStatus: order.paymentStatus || 'Pending',

        // Cancellation details (if cancelled)
...(order.status === 'Cancelled' && order.cancellation ? {
  cancelReason: order.cancellation.reason || '-',
  cancelledBy: order.cancellation.cancelledBy || '-',
  cancelledAt: order.cancellation.cancelledAt || null,
  cancelAdditionalComments: order.cancellation.additionalComments || '',
} : {}),
      };
    });

    res.json({
      success: true,
      data: formattedOrders,
      total: total
    });

  } catch (err) {
    console.error('❌ Get All Orders Error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders',
      error: err.message
    });
  }
};


// exports.createOrder = async (req, res) => {
//   try {
//     const { couponCode, paymentType,transactionId } = req.body;
//     // Ensure transactionId is destructured from req.body before payment creation
//     const userId = req.user?._id || req.params.userId;
//     if (!userId) return res.status(400).json({ message: 'User ID is required', success: false });
//     console.log(userId);
//     // Step 1: Resolve deliveryAddress (prefer body, fallback to user's default)
//     const User = require('../models/User');
//     const userData = await User.findById(userId);
//     if (!userData) {
//       return res.status(400).json({ message: 'User not found', success: false });
//     }
//     let deliveryAddress = req.body.deliveryAddress;
//     if (deliveryAddress && deliveryAddress.name && deliveryAddress.address) {
//       // Normalize provided address and ensure optional fields
//       deliveryAddress = {
//         ...deliveryAddress,
//         default: deliveryAddress.default ?? false,
//         addressType: deliveryAddress.addressType || 'Home',
//         latitude: deliveryAddress.latitude ?? userData.latitude ?? null,
//         longitude: deliveryAddress.longitude ?? userData.longitude ?? null,
//       };
//     } else {
//       // Fall back to user's saved default address
//       if (!userData.address || userData.address.length === 0) {
//         return res.status(400).json({ message: 'No delivery address found', success: false });
//       }
//       const defaultAddress = userData.address.find(addr => addr.default);
//       if (!defaultAddress) {
//         return res.status(400).json({ message: 'No default delivery address found', success: false });
//       }
//       deliveryAddress = {
//         ...defaultAddress.toObject(),
//         latitude: defaultAddress.latitude || userData.latitude,
//         longitude: defaultAddress.longitude || userData.longitude
//       };
//     }
//     // Step 2: Fetch cart and products
//     const cart = await Cart.findOne({ userId });
//     if (!cart || cart.cartProduct.length === 0)
//       return res.status(400).json({ message: 'Cart is empty', success: false });
//     const cartItems = cart.cartProduct;
//     const productIds = cartItems.map(item => item.productId);
//     const productDocs = await Product.find({ _id: { $in: productIds } });
//     // Map productId to quantity from cart
//     const productQuantities = {};
//     cartItems.forEach(item => {
//       productQuantities[item.productId.toString()] = item.quantity;
//     });
//     // Attach quantity to each product
//     const allProducts = productDocs.map(prod => {
//       const quantity = productQuantities[prod._id.toString()] || 1;
//       return { ...prod.toObject(), quantity };
//     });
//     // --- Group products by shopId ---
//     const productsByShop = {};
//     for (const prod of allProducts) {
//       const sId = prod.shopId?.toString();
//       if (!productsByShop[sId]) productsByShop[sId] = [];
//       productsByShop[sId].push(prod);
//     }
//     // Calculate original total from nested part prices (all products)
//     let originalTotal = 0;
//     for (const product of allProducts) {
//       for (const category of product.subCategories || []) {
//         for (const part of category.parts || []) {
//           const quantity = productQuantities[product._id.toString()] || 1;
//           originalTotal += quantity * (part.discountedPrice || part.price || 0);
//         }
//       }
//     }
//     // Step 3: Calculate offers (TODO: Per shop? Not implemented here)
//     // Step 4: Apply coupon (applies only once to whole order, not per shop)
//     const priceAfterOffers = originalTotal;
//     let couponDiscount = 0, appliedCoupon = null;
//     if (couponCode) {
//       const coupon = await Coupon.findOne({ code: couponCode, isActive: true });
//       if (!coupon) return res.status(400).json({ message: 'Invalid coupon', success: false });
//       const currentUserUsage = coupon.userId?.filter(id => id.toString() === userId.toString()).length || 0;
//       if (new Date() > coupon.expiryDate) return res.status(400).json({ message: 'Coupon expired', success: false });
//       if (coupon.usageLimit && currentUserUsage >= coupon.usageLimit)
//         return res.status(400).json({ message: 'Coupon usage limit reached', success: false });
//       if (coupon.minOrderAmount && priceAfterOffers < coupon.minOrderAmount) {
//         console.warn(`Coupon minimum order not met: Required ₹${coupon.minOrderAmount}, but got ₹${priceAfterOffers}`);
//         return res.status(400).json({
//           message: `Coupon code requires minimum order of ₹${coupon.minOrderAmount}, but current order is ₹${priceAfterOffers}`,
//           success: false
//         });
//       }
//       couponDiscount = coupon.discountType === 'percent'
//         ? (priceAfterOffers * coupon.discountValue) / 100
//         : coupon.discountValue;
//       appliedCoupon = {
//         code: coupon.code,
//         discountType: coupon.discountType,
//         discountValue: coupon.discountValue
//       };
//       coupon.usedCount += 1;
//       coupon.userId.push(userId);
//       await coupon.save();
//     }
//     const totalDiscount = couponDiscount;
//     const totalAmount = +(originalTotal - totalDiscount).toFixed(2);
//     // Delivery charge logic: true for each order if master cart < 500, else false
//     const deliverycharge = originalTotal < 500;
//     const savings = totalDiscount;
//     let masterDeliveryCharge = 0;
//     if (originalTotal < 500) {
//       masterDeliveryCharge = 30;
//     }
//     // Update finalPayable to include master delivery charge
//     const finalPayable = totalAmount + masterDeliveryCharge;
//     // Step 5: Get user lat/lng if missing
//     if (!deliveryAddress.latitude || !deliveryAddress.longitude) {
//       const fullAddress = `${deliveryAddress.flatNumber}, ${deliveryAddress.area}, ${deliveryAddress.place}`;
//       const coords = await getLatLngFromAddress(fullAddress);
//       if (coords) {
//         deliveryAddress.latitude = coords.latitude;
//         deliveryAddress.longitude = coords.longitude;
//       }
//     }
//     // --- Step 6: Per-shop order creation, parallelized ---
//     const shopIds = Object.keys(productsByShop);
//     // --- Create MasterOrder first so its _id is available ---
//     // We'll create an empty MasterOrder and update it after collecting orderIds
//     const masterOrder = new MasterOrder({
//       userId,
//       orderIds: [], // will update after per-shop orders
//       totalAmount: originalTotal,
//       // Set deliverycharge as 30 if total < 500, else 0
//       deliverycharge: masterDeliveryCharge,
//       finalPayable: finalPayable,
//       couponApplied: appliedCoupon ? {
//         code: appliedCoupon.code,
//         discountType: appliedCoupon.discountType,
//         discountValue: appliedCoupon.discountValue,
//         discountAmount: totalDiscount
//       } : null
//     });
//     await masterOrder.save();
//     // Helper for per-shop order creation
//     async function processShopOrder(shopId, shopProducts) {
//       // Calculate per-shop total
//       let shopOriginalTotal = 0;
//       for (const product of shopProducts) {
//         for (const category of product.subCategories || []) {
//           for (const part of category.parts || []) {
//             const quantity = productQuantities[product._id.toString()] || 1;
//             shopOriginalTotal += quantity * (part.discountedPrice || part.price || 0);
//           }
//         }
//       }
//       // Calculate delivery distance/earning
//       const shop = await Shop.findOne({ _id: shopId });
//       const shopLatLng = shop?.shopeDetails?.shopLocation?.split(',').map(Number);
//       let deliveryDistance = 0;
//       let deliveryEarning = 0;
//       if (shopLatLng?.length === 2 && deliveryAddress.latitude && deliveryAddress.longitude) {
//         deliveryDistance = geolib.getDistance(
//           { latitude: shopLatLng[0], longitude: shopLatLng[1] },
//           { latitude: deliveryAddress.latitude, longitude: deliveryAddress.longitude }
//         ) / 1000;
//         deliveryEarning = +(PER_KM_RATE * deliveryDistance).toFixed(2);
//       }
//       // Batch update stock for all products in this shop
//       const stockUpdates = shopProducts.map(prod => {
//         const quantityObj = cart.cartProduct.find(p => p.productId.toString() === prod._id.toString());
//         const quantityToReduce = quantityObj?.quantity || 1;
//         return Stock.findOneAndUpdate(
//           { shopId, productId: prod._id },
//           { $inc: { quantity: -quantityToReduce } },
//           { new: true }
//         );
//       });
//       await Promise.all(stockUpdates);
//       // Calculate per-shop coupon discount (proportionally to shop's products)
//       let totalCouponDiscount = 0;
//       if (couponDiscount > 0 && allProducts.length > 0) {
//         // Calculate shop subtotal (again, for coupon split)
//         let shopSubtotal = 0;
//         for (const product of shopProducts) {
//           for (const category of product.subCategories || []) {
//             for (const part of category.parts || []) {
//               const quantity = productQuantities[product._id.toString()] || 1;
//               shopSubtotal += quantity * (part.discountedPrice || part.price || 0);
//             }
//           }
//         }
//         totalCouponDiscount = +(couponDiscount * (shopSubtotal / originalTotal)).toFixed(2);
//       }
//       // Save order for this shop, and include masterOrderId
//       const createdOrder = new Order({
//         userId,
//         shopId,
//         productId: shopProducts.map(p => ({
//           productId: p._id,
//           quantity: productQuantities[p._id.toString()] || 1
//         })),
//         products: shopProducts.map(p => p.toObject ? p.toObject() : p),
//         shopDetails: shop?.shopeDetails || {},
//         deliveryAddress, // uses the new logic above
//         totalAmount: shopOriginalTotal,
//         finalPayable: (shopOriginalTotal - (totalCouponDiscount || 0)),
//         // Delivery charge per order: boolean: true if masterDeliveryCharge > 0, else false
//         deliverycharge: masterDeliveryCharge > 0,
//         couponCode,
//         appliedCoupon,
//         transactionId: transactionId || null,
//         orderStatus: 'Pending',
//         orderStatusList: [{ status: 'Pending', date: new Date() }],
//         refundRequest: { requested: false, status: 'Pending' },
//         deliveryDistance,
//         deliveryEarning,
//         paymentType,
//         additionalcharges: 0,
//         masterOrderId: masterOrder._id,
//       });
//       // Debug log for deliverycharge
//       console.log(`Order for shop ${shopId} deliverycharge:`, originalTotal < 500);
//       await createdOrder.save();
//       // Push order to shop.orders[]
//       const shopPushPromise = Shop.findByIdAndUpdate(shopId, {
//         $push: {
//           orders: {
//             orderId: createdOrder._id
//           }
//         }
//       });
//       // Emit socket event per shop
//       let io;
//       try {
//         io = require('../sockets/socket').getIO();
//         io.emit('newOrder', {
//           shopId: shopId.toString(),
//           order: createdOrder,
//           shopDetails: shop?.shopeDetails || {},
//         });
//       } catch (err) {
//         console.error('Socket.IO emit failed:', err.message);
//       }
//       // Wait for shopPushPromise to finish
//       await shopPushPromise;
//       return {
//         createdOrder,
//         shopId,
//         shopDetails: shop,
//         deliveryDistance,
//         deliveryEarning,
//         shopOriginalTotal,
//         productCount: shopProducts.length
//       };
//     }
//     // Parallelize per-shop order creation
//     const perShopOrderPromises = shopIds.map(shopId =>
//       processShopOrder(shopId, productsByShop[shopId])
//     );
//     const perShopResults = await Promise.all(perShopOrderPromises);
//     const allOrderIds = perShopResults.map(r => r.createdOrder._id);
//     const perShopOrderInfo = perShopResults.map(r => ({
//       order: r.createdOrder,
//       shopId: r.shopId,
//       shopDetails: r.shopDetails,
//       deliveryDistance: r.deliveryDistance,
//       deliveryEarning: r.deliveryEarning,
//       shopOriginalTotal: r.shopOriginalTotal,
//       productCount: r.productCount
//     }));
//     // Update masterOrder with orderIds
//     masterOrder.orderIds = allOrderIds;
//     await masterOrder.save();
//     // Step 8: Clear cart using batch update
//     await Cart.updateOne({ userId }, { $set: { cartProduct: [] } });
//     // 🔐 Create payment after order is saved successfully
//     if (paymentType !== 'COD') {
//       // For each shop, create a separate Payment document
//       for (const result of perShopResults) {
//         const payment = new Payment({
//           orderId: result.createdOrder._id,
//           userId,
//           shopId: result.shopId,
//           amount: result.createdOrder.finalPayable,
//           paymentMethod: paymentType,
//           transactionId: transactionId || null,
//           paymentStatus: 'Paid'
//         });
//         await payment.save();
//       }
//     }
//     // Step 9: Respond
//     return res.status(201).json({
//       message: 'Order placed successfully',
//       success: true,
//       data: {
//         orderIds: allOrderIds,
//         originalTotal,
//         discount: totalDiscount,
//         totalAmount,
//         finalPayable,
//         deliverycharge, // boolean: per order, true if < 500, else false
//         masterDeliveryCharge,
//         savings,
//         perShopOrderInfo,
//         appliedCoupon,
//         deliveryAddress,
//         items: allProducts.length,
//         products: allProducts,
//         additionalcharges: 0,
//         paymentType,
//         masterOrderId: masterOrder._id
//       }
//     });
//   } catch (err) {
//     console.error('Create Order Error:', err);
//     res.status(500).json({
//       message: 'Failed to place order',
//       success: false,
//       data: err.message
//     });
//   }
// };
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
    const { userId } = req.params;

    const orders = await Order.find({ userId })
      .sort({ createdAt: -1 })
      .populate('shopId', 'shopeDetails.shopName')
      .populate('items.shopProductId', 'price discountedPrice')
      .lean();

    const formatted = orders.map(order => ({
      orderId: order._id,
      shop: order.shopId?.shopeDetails?.shopName,
      status: order.status,
      totalPayable: order.totalPayable,
      createdAt: order.createdAt,
      items: order.items.map(i => {
        const shopProduct = i.shopProductId;
        const snapshotPrice = i.snapshot?.price || 0;
        const snapshotDiscounted = i.snapshot?.discountedPrice;
        const shopOriginalPrice = shopProduct?.price || 0;
        const shopDiscountedPrice = shopProduct?.discountedPrice;

        let price, discountedPrice;
        if (snapshotDiscounted != null) {
          // New order format: snapshot has both original and discounted
          price = snapshotPrice;
          discountedPrice = snapshotDiscounted;
        } else if (shopDiscountedPrice != null && shopOriginalPrice > snapshotPrice) {
          // Old order: snapshot.price is the discounted value, get original from ShopProduct
          price = shopOriginalPrice;
          discountedPrice = snapshotPrice;
        } else {
          // No discount at all
          price = shopOriginalPrice || snapshotPrice;
          discountedPrice = snapshotPrice;
        }

        const finalPrice = discountedPrice;
        const hasDiscount = price > discountedPrice;

        return {
          quantity: i.quantity,
          partNumber: i.snapshot?.partNumber,
          partName: i.snapshot?.partName,
          brand: i.snapshot?.brand,
          model: i.snapshot?.model,
          category: i.snapshot?.category,
          price,
          discountedPrice,
          finalPrice,
          hasDiscount,
          image: i.snapshot?.image
        };
      })
    }));

    res.json({ success: true, data: formatted });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

  // exports.getAllOrders = async (req, res) => {
  //   try {
  //     const {
  //       search,
  //       status,
  //       shopId,
  //       userId,
  //       deliveryBoyId,
  //       from,
  //       to,
  //       page = 1,
  //       limit = 10,
  //       sort = 'desc',
  //       sortBy = 'createdAt'
  //     } = req.query;
  
  //     let filter = {};
  
  //     if (search) {
  //       filter.$or = [
  //         { _id: search },
  //         { availableCoupon: { $regex: search, $options: 'i' } },
  //         { offers: { $regex: search, $options: 'i' } }
  //       ];
  //     }
  
  //     if (status) {
  //       filter.orderStatus = status;
  //     }
  
  //     if (shopId) {
  //       filter.shopId = shopId;
  //     }
  
  //     if (userId) {
  //       filter.userId = userId;
  //     }
  
  //     if (deliveryBoyId) {
  //       filter.assignedDeliveryBoy = deliveryBoyId;
  //     }
  
  //     if (from && to) {
  //       filter.createdAt = {
  //         $gte: new Date(from),
  //         $lte: new Date(to)
  //       };
  //     }
  
  //     const orders = await Order.find(filter)
  //       .sort({ [sortBy]: sort === 'asc' ? 1 : -1 })
  //       .skip((page - 1) * limit)
  //       .limit(parseInt(limit));
  
  //     const total = await Order.countDocuments(filter);
  
  //     return res.status(200).json({
  //       message: 'Orders fetched successfully',
  //       success: true,
  //       total,
  //       page: parseInt(page),
  //       limit: parseInt(limit),
  //       data: orders
  //     });
  
  //   } catch (error) {
  //     console.error('Get Orders Error:', error);
  //     return res.status(500).json({
  //       message: 'Failed to fetch orders',
  //       success: false,
  //       data: error.message
  //     });
  //   }
  // };

// 2. View Orders By Shop (Shop Admin)

exports.viewOrdersByShopAdmin = async (req, res) => {
  try {
    const { shopId } = req.params;
    const { status, startDate, endDate } = req.query;

    // Build filter
    const filter = { shopId };
    
    if (status) filter.status = status;
    
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    // Fetch orders with all necessary population
    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate('userId', 'name email phone')
        .populate('shopId', 'shopeDetails.shopName shopeDetails.shopAddress shopeDetails.EmiratesIdImage orders')
        // Populate delivery boy with agency details
        .populate({
          path: 'assignedDeliveryBoy',
          select: 'name phone agencyId',
          populate: {
            path: 'agencyId',
            select: 'agencyDetails.agencyName agencyDetails.agencyContact',
            model: 'DeliveryAgency'
          }
        })
        .populate({
          path: 'items.shopProductId',
          populate: {
            path: 'part',
            select: 'partName images'
          }
        })
        .sort({ createdAt: 1 })
        .lean(),
      Order.countDocuments(filter)
    ]);

    // Format orders for table view
    const formattedOrders = orders.map(order => {
      const orderCount = order.shopId?.orders?.length || 0;
      
      // Extract delivery boy and agency information
      const deliveryBoyName = order.assignedDeliveryBoy?.name || 'Not Assigned';
      const agencyName = order.assignedDeliveryBoy?.agencyId?.agencyDetails?.agencyName || '-';
      
      return {
        _id: order._id,
        
        // Customer
        customerName: order.deliveryAddress?.name || order.userId?.name || '-',
        customerPhone: order.deliveryAddress?.contact || order.userId?.phone || '-',
        
        // Status
        orderStatus: order.status || order.orderStatus || 'pending',
        
        // First item details (for preview)
        productName: order.items?.[0]?.snapshot?.partName || 
                     order.items?.[0]?.shopProductId?.part?.partName || 
                     'Product',
        productImage: order.items?.[0]?.snapshot?.image || 
                      order.items?.[0]?.shopProductId?.part?.images?.[0] || 
                      null,
        itemCount: order.items?.length || 0,
        quantity: order.items?.reduce((sum, item) => sum + (item.quantity || 1), 0) || 1,
        createdAt: order.createdAt,
        
        // Financial
        totalAmount: order.subtotal || order.totalAmount || 0,
        finalPayable: order.totalPayable || order.finalPayable || 0,
        
        // Delivery
        deliveryAddress: order.deliveryAddress,
        deliveryBoy: deliveryBoyName,
        agencyName: agencyName,
        
        // Shop
        shopName: order.shopId?.shopeDetails?.shopName || 'Unknown Shop',
        shopAddress: order.shopId?.shopeDetails?.shopAddress || '-',
        emiratesIdImage: order.shopId?.shopeDetails?.EmiratesIdImage || null,
        orderCount: orderCount,
        
        // Payment
        paymentMethod: order.paymentType || order.paymentMethod || 'Cash',
        paymentStatus: order.paymentStatus || 'Pending',

        ...(order.status === 'Cancelled' && order.cancellation ? {
    cancelReason: order.cancellation.reason || '-',
    cancelledBy: order.cancellation.cancelledBy || '-',
    cancelledAt: order.cancellation.cancelledAt || null,
    cancelAdditionalComments: order.cancellation.additionalComments || '',
  } : {}),
        
        // All items (full details for this shop admin view)
        // items: order.items?.map(item => ({
        //   quantity: item.quantity || 1,
        //   partNumber: item.snapshot?.partNumber || '-',
        //   partName: item.snapshot?.partName || 
        //             item.shopProductId?.part?.partName || 
        //             'Product',
        //   brand: item.snapshot?.brand || '-',
        //   model: item.snapshot?.model || '-',
        //   category: item.snapshot?.category || '-',
        //   price: item.snapshot?.price || item.price || 0,
        //   image: item.snapshot?.image || 
        //          item.shopProductId?.part?.images?.[0] || 
        //          null
        // })) || []
      };
    });

    res.json({
      success: true,
      data: formattedOrders,
      total: total
    });

  } catch (err) {
    console.error('❌ View Orders By Shop Admin Error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch shop orders',
      error: err.message
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
      { status: newStatus },
      { new: true }
    );

    if (!updatedOrder) {
      return res.status(404).json({
        message: 'Order not found',
        success: false,
        data: []
      });
    }

    // 🔔 Emit real-time status update to customer
    let io;
    try {
      io = require('../sockets/socket').getIO();
      const statusUpdate = {
        shopId: updatedOrder.shopId.toString(),
        orderId: updatedOrder._id.toString(),
        newStatus: updatedOrder.status || updatedOrder.orderStatus
      };
      
      // Emit to the specific customer who owns the order
      if (updatedOrder.userId) {
        io.to(updatedOrder.userId.toString()).emit('orderStatusUpdated', statusUpdate);
        console.log(`📤 Emitted order status update to customer: ${updatedOrder.userId}`);
      } else {
        // Fallback: broadcast if userId is missing
        io.emit('orderStatusUpdated', statusUpdate);
      }
    } catch (err) {
      console.error('Socket.IO emit failed:', err.message);
    }

    // In-app notification + push for customer
    if (updatedOrder.userId) {
      notifyUser(
        updatedOrder.userId.toString(),
        'Order update',
        `Your order #${updatedOrder._id} is now ${newStatus}`,
        { route: 'order_details', order_id: String(updatedOrder._id) },
        'order_status'
      ).catch((e) => console.error('Notification failed:', e.message));
    }

    const User = require('../models/User');
    const orderUser = await User.findById(updatedOrder.userId).select('email name').lean();
    if (orderUser?.email) {
      sendOrderStatusUpdate(
        orderUser.email,
        orderUser.name,
        String(updatedOrder._id),
        newStatus
      ).then((r) => { if (!r.sent) console.warn('Order status email skipped:', r.error); })
        .catch((e) => console.warn('Order status email error:', e.message));
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
      const { reason, additionalComments, cancelledBy } = req.body;

      if (!orderId) {
        return res.status(400).json({
          message: 'OrderId is required',
          success: false,
          data: []
        });
      }

      // Require a cancellation reason
      if (!reason) {
        return res.status(400).json({
          message: 'Cancellation reason is required',
          success: false,
          data: []
        });
      }

      // Find the order first to check if it can be cancelled
      const order = await Order.findById(orderId);

      if (!order) {
        return res.status(404).json({
          message: 'Order not found',
          success: false,
          data: []
        });
      }

      // Check if order is already cancelled
      if (order.status === 'Cancelled') {
        return res.status(400).json({
          message: 'Order is already cancelled',
          success: false,
          data: []
        });
      }

      // Check if order can be cancelled (not delivered or out for delivery)
      const nonCancellableStatuses = ['Delivered', 'Out for Delivery'];
      if (nonCancellableStatuses.includes(order.status)) {
        return res.status(400).json({
          message: `Cannot cancel order with status: ${order.status}`,
          success: false,
          data: []
        });
      }

      const updatedOrder = await Order.findByIdAndUpdate(
        orderId,
        {
          status: 'Cancelled',
          cancellation: {
            isCancelled: true,
            cancelledAt: new Date(),
            cancelledBy: cancelledBy || 'customer',
            reason: reason,
            additionalComments: additionalComments || ''
          },
          $push: {
            statusHistory: {
              status: 'Cancelled',
              date: new Date()
            }
          }
        },
        { new: true }
      );

      // Restore stock for cancelled items
      for (const item of order.items) {
        await ShopProduct.findByIdAndUpdate(item.shopProductId, {
          $inc: { stock: item.quantity }
        });
      }

      // Emit socket event for order cancellation
      try {
        const io = require('../sockets/socket').getIO();
        io.emit('orderCancelled', {
          orderId: updatedOrder._id.toString(),
          shopId: updatedOrder.shopId.toString(),
          userId: updatedOrder.userId.toString(),
          reason: reason,
          cancelledBy: cancelledBy || 'customer'
        });
      } catch (err) {
        console.error('Socket.IO emit failed:', err.message);
      }

      if (updatedOrder.userId) {
        notifyUser(
          updatedOrder.userId.toString(),
          'Order cancelled',
          `Your order #${updatedOrder._id} has been cancelled.`,
          { route: 'order_details', order_id: String(updatedOrder._id) },
          'order_status'
        ).catch((e) => console.error('Notification failed:', e.message));
        const User = require('../models/User');
        const cancelUser = await User.findById(updatedOrder.userId).select('email name').lean();
        if (cancelUser?.email) {
          const reasonText = reason ? (additionalComments ? `${reason}. ${additionalComments}` : reason) : null;
          sendOrderCancelled(
            cancelUser.email,
            cancelUser.name,
            String(updatedOrder._id),
            reasonText,
            cancelledBy || 'customer'
          ).then((r) => { if (!r.sent) console.warn('Order cancelled email skipped:', r.error); })
            .catch((e) => console.warn('Order cancelled email error:', e.message));
        }
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

      if (updatedOrder.userId) {
        notifyUser(
          updatedOrder.userId.toString(),
          'Order refunded',
          `Your order #${updatedOrder._id} has been refunded.`,
          { route: 'order_details', order_id: String(updatedOrder._id) },
          'order_status'
        ).catch((e) => console.error('Notification failed:', e.message));
        const User = require('../models/User');
        const refundUser = await User.findById(updatedOrder.userId).select('email name').lean();
        if (refundUser?.email) {
          const refundMessage = updatedOrder.refundDetails
            ? `Amount: ${updatedOrder.refundDetails.refundAmount || 'Full'}. ${updatedOrder.refundDetails.refundReason || ''}`
            : null;
          sendOrderStatusUpdate(
            refundUser.email,
            refundUser.name,
            String(updatedOrder._id),
            'Refunded',
            refundMessage
          ).then((r) => { if (!r.sent) console.warn('Order refunded email skipped:', r.error); })
            .catch((e) => console.warn('Order refunded email error:', e.message));
        }
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

      if (action === 'accept' && updatedOrder.userId) {
        notifyUser(
          updatedOrder.userId.toString(),
          'Order accepted',
          `Your order #${updatedOrder._id} has been accepted by the delivery partner.`,
          { route: 'order_details', order_id: String(updatedOrder._id) },
          'order_status'
        ).catch((e) => console.error('Notification failed:', e.message));
        const User = require('../models/User');
        const orderUser = await User.findById(updatedOrder.userId).select('email name').lean();
        if (orderUser?.email) {
          sendOrderStatusUpdate(
            orderUser.email,
            orderUser.name,
            String(updatedOrder._id),
            'Accepted by Delivery Boy',
            'Your delivery partner is on the way.'
          ).then((r) => { if (!r.sent) console.warn('Order status email skipped:', r.error); })
            .catch((e) => console.warn('Order status email error:', e.message));
        }
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

      const User = require('../models/User');
      const orderUser = await User.findById(order.userId).select('email name').lean();
      if (orderUser?.email) {
        sendOrderStatusUpdate(
          orderUser.email,
          orderUser.name,
          String(order._id),
          'Delivery Boy Assigned',
          'A delivery partner has been assigned to your order.'
        ).then((r) => { if (!r.sent) console.warn('Order status email skipped:', r.error); })
          .catch((e) => console.warn('Order status email error:', e.message));
      }

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








// ============================================
// IMPROVED AUTO ASSIGN DELIVERY BOY API
// ============================================



// ============================================
// IMPROVED AUTO ASSIGN DELIVERY BOY API
// ============================================
// ============================================
// ENHANCED AUTO ASSIGN WITH SOCKET DEBUGGING
// ============================================

exports.autoAssignDeliveryBoyWithin5km = async (req, res) => {
  try {
    console.log('🚀 API hit: autoAssignDeliveryBoyWithin5km');
    const orderId = req.params.orderId;

    // 1️⃣ Find order
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        message: 'Order not found',
        success: false,
        data: []
      });
    }

    // ✅ CHECK: If order is already assigned, don't reassign
    if (order.assignedDeliveryBoy) {
      return res.status(409).json({
        message: 'Order already assigned to a delivery boy',
        success: false,
        data: {
          assignedTo: order.assignedDeliveryBoy,
          status: order.status
        }
      });
    }

    // 2️⃣ Fetch shop using order.shopId
    const shop = await Shop.findById(order.shopId);
    if (!shop || !shop.shopeDetails || !shop.shopeDetails.shopLocation) {
      return res.status(404).json({
        message: 'Shop location not found',
        success: false,
        data: []
      });
    }

    // ✅ FIX: Validate and parse shop location coordinates
    const shopLocationString = shop.shopeDetails.shopLocation.toString().trim();
    console.log(`📍 Raw shop location: "${shopLocationString}"`);
    
    const coords = shopLocationString.split(',').map(str => str.trim());
    
    if (coords.length !== 2) {
      console.error(`❌ Invalid shop location format: ${shopLocationString}`);
      return res.status(400).json({
        message: 'Invalid shop location coordinates',
        success: false,
        error: `Expected "lat,lng" format, got: ${shopLocationString}`
      });
    }

    const shopLatitude = parseFloat(coords[0]);
    const shopLongitude = parseFloat(coords[1]);

    // ✅ FIX: Validate parsed coordinates
    if (isNaN(shopLatitude) || isNaN(shopLongitude)) {
      console.error(`❌ Failed to parse coordinates: lat="${coords[0]}", lng="${coords[1]}"`);
      return res.status(400).json({
        message: 'Invalid shop location coordinates',
        success: false,
        error: `Could not parse lat="${coords[0]}" or lng="${coords[1]}" as numbers`
      });
    }

    // ✅ FIX: Validate coordinate ranges
    if (shopLatitude < -90 || shopLatitude > 90) {
      console.error(`❌ Invalid latitude: ${shopLatitude}`);
      return res.status(400).json({
        message: 'Invalid shop location coordinates',
        success: false,
        error: `Latitude must be between -90 and 90, got: ${shopLatitude}`
      });
    }

    if (shopLongitude < -180 || shopLongitude > 180) {
      console.error(`❌ Invalid longitude: ${shopLongitude}`);
      return res.status(400).json({
        message: 'Invalid shop location coordinates',
        success: false,
        error: `Longitude must be between -180 and 180, got: ${shopLongitude}`
      });
    }

    console.log(`✅ Valid shop coordinates: lat=${shopLatitude}, lng=${shopLongitude}`);

    // 3️⃣ Fetch available delivery boys
    const deliveryBoys = await DeliveryBoy.find({ availability: true });
    
    if (deliveryBoys.length === 0) {
      return res.status(404).json({
        message: 'No available delivery boys found',
        success: false,
        data: {
          totalDeliveryBoys: await DeliveryBoy.countDocuments(),
          availableDeliveryBoys: 0
        }
      });
    }

    console.log(`📦 Found ${deliveryBoys.length} available delivery boys`);

    // Get customer coordinates from order
    const customerLat = order.deliveryAddress.latitude;
    const customerLng = order.deliveryAddress.longitude;

    // ✅ Calculate distances for all delivery boys
    const deliveryBoysWithDistances = deliveryBoys.map(boy => {
      // ✅ Validate delivery boy coordinates
      if (!boy.latitude || !boy.longitude || isNaN(boy.latitude) || isNaN(boy.longitude)) {
        console.warn(`⚠️ Skipping delivery boy ${boy._id} - invalid coordinates`);
        return null;
      }

      const pickupDistance = calculateDistance(
        shopLatitude,
        shopLongitude,
        boy.latitude,
        boy.longitude
      );

      const dropDistance = calculateDistance(
        shopLatitude,
        shopLongitude,
        customerLat,
        customerLng
      );

      // Earnings based on DROP distance
      const earning = +(dropDistance * PER_KM_RATE).toFixed(2);

      // Estimated time (30 km/h)
      const pickupTime = Math.ceil((pickupDistance / 30) * 60);
      const dropTime = Math.ceil((dropDistance / 30) * 60);

      return {
        ...boy._doc,
        pickupDistance: +pickupDistance.toFixed(2),
        dropDistance: +dropDistance.toFixed(2),
        pickupTime: `${pickupTime} mins`,
        dropTime: `${dropTime} mins`,
        earning
      };
    })
    .filter(boy => boy !== null)
    .sort((a, b) => a.pickupDistance - b.pickupDistance);

    if (deliveryBoysWithDistances.length === 0) {
      return res.status(404).json({
        message: 'No delivery boys with valid coordinates found',
        success: false,
        data: {
          totalDeliveryBoys: deliveryBoys.length,
          deliveryBoysWithValidCoords: 0
        }
      });
    }

    // ✅ FALLBACK RADIUS LOGIC
    const radiusOptions = [3, 5, 10, 50];
    let nearbyDeliveryBoys = [];
    let usedRadius = 0;

    for (const radius of radiusOptions) {
      nearbyDeliveryBoys = deliveryBoysWithDistances.filter(
        boy => boy.pickupDistance <= radius
      );

      if (nearbyDeliveryBoys.length > 0) {
        usedRadius = radius;
        console.log(`✅ Found ${nearbyDeliveryBoys.length} delivery boys within ${radius} km`);
        break;
      }
    }

    if (nearbyDeliveryBoys.length === 0) {
      return res.status(404).json({
        message: 'No delivery boy found within 50 km radius',
        success: false,
        data: {
          searchedRadiuses: radiusOptions,
          totalAvailableDeliveryBoys: deliveryBoys.length,
          closestDeliveryBoyDistance: deliveryBoysWithDistances[0]?.pickupDistance || 'N/A'
        }
      });
    }

    // ✅ Calculate and save delivery earning to order
    const firstDeliveryBoy = nearbyDeliveryBoys[0];
    order.deliveryEarning = firstDeliveryBoy.earning;
    order.deliveryDistance = firstDeliveryBoy.dropDistance;
    order.searchRadius = usedRadius;

    // ✅ Update status
    order.status = 'Delivery Boy Assigned';
    await order.save();

    // Push to statusHistory
    await Order.findByIdAndUpdate(order._id, {
      $push: {
        statusHistory: {
          status: 'Delivery Boy Assigned',
          date: new Date()
        }
      }
    });

    // ✅ ENHANCED: Notify delivery boys with better logging
console.log('\n🔔 ========== SOCKET EMISSION START ==========');
const socketModule = require('../sockets/socket');
const { getIO, isUserConnected } = socketModule;

let io;
let successfulEmissions = 0;
let failedEmissions = 0;

try {
  io = getIO();
  console.log('✅ Socket.IO instance retrieved');
  console.log('📋 Currently connected users:', Object.keys(socketModule.getConnectedUsers()));

  const emissionData = {
    message: 'You have a new order to accept or reject',
    orderId: order._id.toString(),
    data: {
      nearbyDeliveryBoys,
      order: {
        ...order._doc,
        searchRadius: usedRadius
      },
      shop: {
        id: shop._id,
        shopeDetails: shop.shopeDetails
      }
    }
  };

  console.log(`\n📋 Emission Data Summary:`);
  console.log(`   Order ID: ${order._id}`);
  console.log(`   Delivery Earning: ${order.deliveryEarning} AED`);
  console.log(`   Search Radius: ${usedRadius} km`);
  console.log(`   Nearby Delivery Boys: ${nearbyDeliveryBoys.length}`);

  nearbyDeliveryBoys.forEach((boy, index) => {
    const deliveryBoyId = boy._id.toString();
    
    console.log(`\n📤 [${index + 1}/${nearbyDeliveryBoys.length}] Attempting emission:`);
    console.log(`   Delivery Boy ID: ${deliveryBoyId}`);
    console.log(`   Name: ${boy.name || 'N/A'}`);
    console.log(`   Phone: ${boy.phone || 'N/A'}`);
    console.log(`   Distance: ${boy.pickupDistance} km`);
    console.log(`   Is Connected: ${isUserConnected(deliveryBoyId) ? '✅ YES' : '❌ NO'}`);
    
    if (isUserConnected(deliveryBoyId)) {
      console.log(`   Socket ID: ${socketModule.getConnectedUsers()[deliveryBoyId]}`);
    }

    try {
      io.to(deliveryBoyId).emit('new_order_assigned', emissionData);
      sendPushOnly(deliveryBoyId, 'New order assigned', 'You have been assigned a new order.', {
        route: 'order_assigned',
        order_id: order._id.toString()
      }).catch(() => {});
      console.log(`   ✅ Emission sent to room: ${deliveryBoyId}`);
      if (isUserConnected(deliveryBoyId)) successfulEmissions++;
      else failedEmissions++;
    } catch (emitError) {
      console.error(`   ❌ Emission failed: ${emitError.message}`);
      failedEmissions++;
    }
  });

  console.log('\n📊 Emission Summary:');
  console.log(`   ✅ Successful: ${successfulEmissions}`);
  console.log(`   ❌ Failed/Uncertain: ${failedEmissions}`);
  console.log(`   📱 Total attempted: ${nearbyDeliveryBoys.length}`);

} catch (err) {
  console.error('❌ Socket.IO error:', err.message);
  console.error('Stack:', err.stack);
}

console.log('🔔 ========== SOCKET EMISSION END ==========\n');

    const User = require('../models/User');
    const orderUser = await User.findById(order.userId).select('email name').lean();
    if (orderUser?.email) {
      sendOrderStatusUpdate(
        orderUser.email,
        orderUser.name,
        String(order._id),
        'Delivery Boy Assigned',
        'A delivery partner has been assigned to your order.'
      ).then((r) => { if (!r.sent) console.warn('Order status email skipped:', r.error); })
        .catch((e) => console.warn('Order status email error:', e.message));
    }

    return res.status(200).json({
      message: `Order assignment request sent to ${nearbyDeliveryBoys.length} delivery boys within ${usedRadius} km`,
      success: true,
      data: {
        nearbyDeliveryBoys,
        order: {
          ...order._doc,
          searchRadius: usedRadius
        },
        shop: {
          id: shop._id,
          shopeDetails: shop.shopeDetails
        },
        searchInfo: {
          usedRadius: `${usedRadius} km`,
          totalDeliveryBoysNotified: nearbyDeliveryBoys.length,
          successfulEmissions,
          failedEmissions
        }
      }
    });
  } catch (error) {
    console.error('❌ Auto Assign Delivery Boy Error:', error);
    console.error('Stack:', error.stack);
    return res.status(500).json({
      message: 'Failed to auto assign delivery boy',
      success: false,
      data: error.message
    });
  }
};

// ============================================
// HELPER FUNCTIONS
// ============================================
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees) {
  return degrees * (Math.PI / 180);
}

// ============================================
// FIX 2: Get Nearby Assigned Orders - No changes needed
// This already uses the correct 'status' field
// ============================================

exports.getNearbyAssignedOrders = async (req, res) => {
  try {
    const deliveryBoyId = req.params.deliveryBoyId;

    const deliveryBoy = await DeliveryBoy.findById(deliveryBoyId);
    if (!deliveryBoy || !deliveryBoy.latitude || !deliveryBoy.longitude) {
      return res.status(404).json({
        message: 'Delivery Boy not found or location unavailable',
        success: false,
        data: []
      });
    }

    const { latitude: boyLat, longitude: boyLng } = deliveryBoy;
    const RANGE_KM = 20;

    console.log(`📍 Delivery Boy Location: ${boyLat}, ${boyLng}`);

    const assignedOrders = await Order.find({
      status: 'Delivery Boy Assigned'
    }).populate('deliveryAddress');

    const formattedNearbyOrders = [];

    for (const order of assignedOrders) {
      const shop = await Shop.findById(order.shopId);
      const shopLocation = shop?.shopeDetails?.shopLocation;

      if (!shopLocation) {
        console.log(`⚠️ Shop location not found for order ${order._id}`);
        continue;
      }

      const [shopLat, shopLng] = shopLocation.split(',').map(Number);

      console.log(`📍 Shop Location: ${shopLat}, ${shopLng}`);
      console.log(`📍 Customer Location: ${order.deliveryAddress?.latitude}, ${order.deliveryAddress?.longitude}`);

      // ✅ Calculate pickup distance (delivery boy to shop)
      const pickupDistance =
        geolib.getDistance(
          { latitude: boyLat, longitude: boyLng },
          { latitude: shopLat, longitude: shopLng }
        ) / 1000;

      console.log(`🚗 Pickup Distance: ${pickupDistance.toFixed(2)} km`);

      if (pickupDistance > RANGE_KM) {
        console.log(`❌ Order ${order._id} too far: ${pickupDistance.toFixed(2)} km`);
        continue;
      }

      // ✅ Pickup time calculation with fallback
      let pickupTime = 'N/A';
      try {
        const pickupUrl = encodeURI(
          `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${boyLat},${boyLng}&destinations=${shopLat},${shopLng}&key=${GOOGLE_MAPS_API_KEY}`
        );
        const pickupResponse = await axios.get(pickupUrl);
        const pickupElement = pickupResponse.data?.rows?.[0]?.elements?.[0];
        
        if (pickupElement?.status === 'OK' && pickupElement?.duration) {
          pickupTime = pickupElement.duration.text;
        } else {
          console.log(`⚠️ Pickup time API returned: ${pickupElement?.status}`);
          pickupTime = `${Math.ceil((pickupDistance / 30) * 60)} mins`;
        }
      } catch (err) {
        console.log(`❌ Pickup time API error: ${err.message}`);
        pickupTime = `${Math.ceil((pickupDistance / 30) * 60)} mins`;
      }

      // ✅ Drop distance and time calculation (shop to customer)
      let dropDistance = 0;
      let dropTime = 'N/A';

      const customerLat = order?.deliveryAddress?.latitude;
      const customerLng = order?.deliveryAddress?.longitude;

      // ✅ Check if all coordinates are valid numbers
      if (
        !isNaN(shopLat) &&
        !isNaN(shopLng) &&
        !isNaN(customerLat) &&
        !isNaN(customerLng) &&
        customerLat !== null &&
        customerLng !== null
      ) {
        // ✅ Calculate drop distance using geolib
        dropDistance =
          geolib.getDistance(
            { latitude: shopLat, longitude: shopLng },
            { latitude: customerLat, longitude: customerLng }
          ) / 1000;

        console.log(`🚚 Drop Distance: ${dropDistance.toFixed(2)} km`);

        // ✅ ALWAYS calculate fallback time first
        const fallbackDropTime = `${Math.ceil((dropDistance / 30) * 60)} mins`;
        dropTime = fallbackDropTime; // Set fallback as default

        // ✅ Only try Google API if distance is reasonable (< 100 km)
        if (dropDistance < 100) {
          try {
            const dropUrl = encodeURI(
              `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${shopLat},${shopLng}&destinations=${customerLat},${customerLng}&key=${GOOGLE_MAPS_API_KEY}`
            );
            const dropResponse = await axios.get(dropUrl);
            const dropElement = dropResponse.data?.rows?.[0]?.elements?.[0];

            if (dropElement?.status === 'OK' && dropElement?.duration) {
              dropTime = dropElement.duration.text; // Override with API result
              console.log(`✅ Drop time from API: ${dropTime}`);
            } else {
              console.log(`⚠️ Drop time API returned: ${dropElement?.status}, using fallback: ${fallbackDropTime}`);
            }
          } catch (err) {
            console.log(`❌ Drop time API error: ${err.message}, using fallback: ${fallbackDropTime}`);
          }
        } else {
          console.log(`⚠️ Drop distance too large (${dropDistance.toFixed(2)} km), using fallback: ${fallbackDropTime}`);
        }
      } else {
        console.log(`❌ Invalid coordinates - Shop: (${shopLat}, ${shopLng}), Customer: (${customerLat}, ${customerLng})`);
      }

      const shopDetails = {
        shopName: shop?.shopeDetails?.shopName || '',
        shopAddress: shop?.shopeDetails?.shopAddress || '',
        shopContact: shop?.shopeDetails?.shopContact || ''
      };

      const deliveryDetails = {
        deliveryBoyId: order.assignedDeliveryBoy || null,
        orderStatus: order.status,
        pickupDistance: `${pickupDistance.toFixed(2)} km`,
        pickupTime,
        dropDistance: `${dropDistance ? dropDistance.toFixed(2) : '0.00'} km`,
        dropTime,
        deliveryEarnings: order.deliveryEarning || 0
      };

      const deliveryAddress = {
        name: order?.deliveryAddress?.name || 'N/A',
        address: order?.deliveryAddress?.address || 'N/A',
        contact: order?.deliveryAddress?.contact || 'N/A',
        area: order?.deliveryAddress?.area || 'N/A',
        place: order?.deliveryAddress?.place || 'N/A',
        latitude: order?.deliveryAddress?.latitude || null,
        longitude: order?.deliveryAddress?.longitude || null
      };

      formattedNearbyOrders.push({
        orderId: order._id,
        shopDetails,
        deliveryDetails,
        deliveryAddress,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt
      });
    }

    console.log(`✅ Found ${formattedNearbyOrders.length} nearby assigned orders`);

    return res.status(200).json({
      message: 'Nearby assigned orders fetched successfully',
      success: true,
      data: formattedNearbyOrders
    });
  } catch (error) {
    console.error('Get Nearby Assigned Orders Error:', error);
    return res.status(500).json({
      message: 'Failed to fetch nearby assigned orders',
      success: false,
      data: error.message
    });
  }
};

// exports.seedDummyOrder = async (req, res) => {
//   try {
//     // Step 1: Create a dummy user ID
//     const userId = new mongoose.Types.ObjectId();

//     // Step 2: Create a dummy shop
//     const shop = await Shop.create({
//       name: 'Dummy Shop',
//       shopeDetails: {
//         shopLocation: '12.9352,77.6145'
//       }
//     });

//     // Step 3: Add products to the shop
//     const product = {
//       _id: new mongoose.Types.ObjectId(),
//       name: 'Test Product',
//       price: 200,
//       image: 'https://via.placeholder.com/150'
//     };

//     const productDoc = await Product.create({
//       shopId: shop._id,
//       products: [product]
//     });

//     // Step 4: Add dummy stock for that product
//     await Stock.create({
//       shopId: shop._id,
//       productId: product._id,
//       quantity: 10
//     });

//     // Step 5: Add dummy address for the user
//     await CustomerAddress.create({
//       userId,
//       customerAddress: [{
//         name: 'John Doe',
//         email: 'john@example.com',
//         flatNumber: '123',
//         contact: '9999999999',
//         area: 'Koramangala',
//         place: 'Bangalore',
//         default: true,
//         addressType: 'Home',
//         latitude: 12.9376,
//         longitude: 77.6192
//       }]
//     });

//     // Step 6: Add product to the cart
//     await Cart.create({
//       userId,
//       cartProduct: [product._id]
//     });

//     return res.status(201).json({
//       message: 'Dummy user, shop, product, stock, address, and cart seeded successfully',
//       success: true,
//       data: {
//         userId: userId,
//         productId: product._id,
//         shopId: shop._id
//       }
//     });

//   } catch (error) {
//     console.error('Dummy Order Seed Error:', error);
//     return res.status(500).json({
//       message: 'Failed to seed dummy order data',
//       success: false,
//       error: error.message
//     });
//   }
// };

const ONES = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'];
const TENS = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];

function numberToWords(n) {
  n = Math.floor(Number(n)) || 0;
  if (n === 0) return 'ZERO';
  if (n < 20) return ONES[n];
  if (n < 100) return (TENS[Math.floor(n / 10)] + ' ' + ONES[n % 10]).trim();
  if (n < 1000) {
    const h = Math.floor(n / 100);
    const r = n % 100;
    return (ONES[h] + ' HUNDRED' + (r ? ' ' + numberToWords(r) : '')).trim();
  }
  if (n < 1000000) {
    const th = Math.floor(n / 1000);
    const r = n % 1000;
    return (numberToWords(th) + ' THOUSAND' + (r ? ' ' + numberToWords(r) : '')).trim();
  }
  if (n < 1000000000) {
    const m = Math.floor(n / 1000000);
    const r = n % 1000000;
    return (numberToWords(m) + ' MILLION' + (r ? ' ' + numberToWords(r) : '')).trim();
  }
  return String(n);
}

/**
 * Generate combined invoice PDF for a master order (multiple shops).
 * @param {Array<Object>} orders - Array of orders (lean, shopId populated), each with items[].snapshot
 * @param {{ masterOrderId: string, grandTotal: number }} options
 * @returns {Promise<Buffer>}
 */
async function getInvoicePdfBufferForMasterOrder(orders, options) {
  if (!orders || orders.length === 0) return getInvoicePdfBuffer(orders[0]); // fallback
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const pageW = doc.page.width - 80;
      const margin = 40;
      const colDesc = margin;
      const colQty = margin + pageW * 0.45;
      const colUnit = margin + pageW * 0.58;
      const colSub = margin + pageW * 0.75;
      let y = 40;

      // Logo / title
      const logoPath = process.env.PREMART_LOGO_PATH || path.join(__dirname, '..', 'public', 'logo.png');
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, margin, y, { width: 100 });
        y += 42;
      } else {
        doc.fontSize(22).font('Helvetica-Bold').text('PREMART', margin, y, { align: 'left' });
        y += 32;
      }
      doc.font('Helvetica').fontSize(18).text('TAX INVOICE – ORDER SUMMARY', margin, y, { align: 'center', width: pageW });
      y += 28;
      doc.fontSize(10).text(`Master Order #: ${options.masterOrderId || 'N/A'}`, margin, y);
      y += 14;
      const firstOrder = orders[0];
      const addr = firstOrder?.deliveryAddress || {};
      doc.font('Helvetica-Bold').text('Bill To:', margin, y);
      doc.font('Helvetica');
      y += 14;
      doc.fontSize(10).text(addr.name || 'Customer', margin, y);
      y += 12;
      doc.text(addr.address || '—', margin, y, { width: pageW / 2 });
      y += 12;
      doc.text(`Contact: ${addr.contact || '—'}`, margin, y);
      y += 20;

      orders.forEach((order, shopIndex) => {
        const sd = order.shopId?.shopeDetails || order.shopId || {};
        const shopName = sd.shopName || `Shop ${shopIndex + 1}`;
        const shopAddress = sd.shopAddress || '';
        const shopContact = sd.shopContact || sd.shopMail || '';

        if (y > doc.page.height - 180) {
          doc.addPage();
          y = 40;
        }
        doc.fontSize(11).font('Helvetica-Bold').text(`Shop: ${shopName}`, margin, y);
        doc.font('Helvetica').fontSize(9);
        y += 14;
        doc.text(`Order #: ${order._id}`, margin, y);
        y += 12;
        if (shopAddress) { doc.text(shopAddress, margin, y, { width: pageW }); y += 12; }
        if (shopContact) { doc.text(`Contact: ${shopContact}`, margin, y); y += 12; }
        y += 6;

        const tableTop = y;
        doc.font('Helvetica-Bold').fontSize(9);
        doc.rect(margin, tableTop, pageW, 18).fillAndStroke('#f0f0f0', '#333');
        doc.fillColor('#000').text('Description', colDesc + 4, tableTop + 4, { width: colQty - colDesc - 4 });
        doc.text('Qty', colQty + 4, tableTop + 4);
        doc.text('Unit Price', colUnit + 4, tableTop + 4);
        doc.text('Subtotal', colSub + 4, tableTop + 4);
        doc.font('Helvetica').fillColor('#000');
        y = tableTop + 20;

        const items = order.items || [];
        let shopSubtotal = 0;
        items.forEach((item) => {
          const snap = item.snapshot || {};
          const name = snap.partName || 'Item';
          const partNo = snap.partNumber || '';
          const qty = item.quantity || 1;
          const unitPrice = snap.discountedPrice != null ? snap.discountedPrice : snap.price || 0;
          const lineTotal = qty * unitPrice;
          shopSubtotal += lineTotal;
          const desc = (partNo ? `${name} (${partNo})` : name).substring(0, 35);
          doc.fontSize(9).text(desc, colDesc + 4, y, { width: colQty - colDesc - 4 });
          doc.text(String(qty), colQty + 4, y);
          doc.text(`AED ${Number(unitPrice).toFixed(2)}`, colUnit + 4, y);
          doc.text(`AED ${Number(lineTotal).toFixed(2)}`, colSub + 4, y);
          y += 16;
        });

        y += 6;
        doc.fontSize(9).text(`Subtotal: AED ${Number(order.subtotal ?? shopSubtotal).toFixed(2)}`, margin, y);
        y += 12;
        const deliveryCharge = Number(order.deliveryCharge || 0);
        if (deliveryCharge > 0) {
          doc.text(`Delivery: AED ${deliveryCharge.toFixed(2)}`, margin, y);
          y += 12;
        }
        const discount = Number(order.discount || 0);
        if (discount > 0) {
          doc.text(`Discount: -AED ${discount.toFixed(2)}`, margin, y);
          y += 12;
        }
        doc.font('Helvetica-Bold').text(`Shop total: AED ${Number(order.totalPayable || 0).toFixed(2)}`, margin, y);
        doc.font('Helvetica');
        y += 24;
      });

      if (y > doc.page.height - 120) {
        doc.addPage();
        y = 40;
      }
      doc.font('Helvetica-Bold').fontSize(12).text(`Grand total: AED ${Number(options.grandTotal || 0).toFixed(2)}`, margin, y);
      doc.font('Helvetica');
      y += 20;
      const whole = Math.floor(options.grandTotal || 0);
      const fils = Math.round((options.grandTotal - whole) * 100);
      doc.fontSize(9).text(`${numberToWords(whole)} AED AND ${String(fils).padStart(2, '0')} FILS`, margin, y, { width: pageW });
      y += 30;

      const footerY = doc.page.height - 50;
      doc.strokeColor('#ccc').lineWidth(0.5).moveTo(margin, footerY).lineTo(margin + pageW, footerY).stroke();
      doc.fontSize(9).fillColor('#555').font('Helvetica-Bold').text('PREMART', margin, footerY + 10);
      doc.font('Helvetica');
      doc.text(process.env.PREMART_INVOICE_ADDRESS || 'Premart', margin, footerY + 24, { width: pageW });
      if (process.env.PREMART_TRN) doc.text(`TRN: ${process.env.PREMART_TRN}`, margin, footerY + 38);
      doc.fillColor('#000');
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Generate invoice PDF buffer – UAE tax invoice style.
 * Order should be lean, with shopId populated.
 * @returns {Promise<Buffer>}
 */
async function getInvoicePdfBuffer(order) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const pageW = doc.page.width - 80;
      const margin = 40;
      let y = 40;

      // ----- Logo at top -----
      const logoPath = process.env.PREMART_LOGO_PATH || path.join(__dirname, '..', 'public', 'logo.png');
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, margin, y, { width: 100 });
        y += 42;
      } else {
        doc.fontSize(22).font('Helvetica-Bold').text('PREMART', margin, y, { align: 'left' });
        y += 32;
      }

      doc.font('Helvetica');
      doc.fontSize(18).text('TAX INVOICE', margin, y, { align: 'center', width: pageW });
      y += 36;

      const sd = order.shopId?.shopeDetails || order.shopId || {};
      const shopName = sd.shopName || 'N/A';
      const shopAddress = sd.shopAddress || '';
      const shopContact = sd.shopContact || sd.shopMail || '';
      const shopTRN = sd.taxRegistrationNumber || process.env.PREMART_TRN || '';

      // ----- Two columns: Bill To (left) | Invoice details (right) -----
      const col1X = margin;
      const col2X = margin + pageW / 2;

      doc.fontSize(10).font('Helvetica-Bold').text('Bill To:', col1X, y);
      doc.font('Helvetica');
      y += 14;
      const addr = order.deliveryAddress || {};
      doc.fontSize(10).text(addr.name || 'Customer', col1X, y);
      y += 12;
      doc.text(addr.address || '—', col1X, y, { width: pageW / 2 - 10 });
      y += 12;
      doc.text(`Contact: ${addr.contact || '—'}`, col1X, y);
      y += 12;
      if (shopTRN) {
        doc.text(`TRN: ${shopTRN}`, col1X, y);
        y += 12;
      }
      const billToBottom = y;

      y = billToBottom - (12 * 3 + 14);
      doc.fontSize(10).font('Helvetica-Bold').text('Invoice Details', col2X, y);
      doc.font('Helvetica');
      y += 14;
      const invDate = new Date(order.createdAt || Date.now());
      const dueDate = new Date(invDate);
      dueDate.setDate(dueDate.getDate() + 15);
      doc.text(`Tax Invoice #: ${order._id}`, col2X, y);
      y += 12;
      doc.text(`Invoice Date: ${invDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`, col2X, y);
      y += 12;
      doc.text(`Due Date: ${dueDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`, col2X, y);
      y += 12;
      doc.text(`Payment: ${order.paymentType || 'N/A'}`, col2X, y);
      y = Math.max(y, billToBottom) + 16;

      // ----- Shop details (seller) -----
      doc.fontSize(10).font('Helvetica-Bold').text('Shop / Seller Details', margin, y);
      doc.font('Helvetica');
      y += 14;
      doc.text(shopName, margin, y);
      y += 12;
      if (shopAddress) {
        doc.text(shopAddress, margin, y, { width: pageW });
        y += 12;
      }
      if (shopContact) {
        doc.text(`Contact: ${shopContact}`, margin, y);
        y += 12;
      }
      if (shopTRN) {
        doc.text(`TRN: ${shopTRN}`, margin, y);
        y += 12;
      }
      y += 10;

      // ----- Table: Description | Qty | Unit Price | Subtotal -----
      const tableTop = y;
      const colDesc = margin;
      const colQty = margin + pageW * 0.45;
      const colUnit = margin + pageW * 0.58;
      const colSub = margin + pageW * 0.75;

      doc.font('Helvetica-Bold').fontSize(9);
      doc.rect(margin, tableTop, pageW, 18).fillAndStroke('#f0f0f0', '#333');
      doc.fillColor('#000').text('Description', colDesc + 4, tableTop + 4, { width: colQty - colDesc - 4 });
      doc.text('Qty', colQty + 4, tableTop + 4);
      doc.text('Unit Price', colUnit + 4, tableTop + 4);
      doc.text('Subtotal', colSub + 4, tableTop + 4);
      doc.font('Helvetica').fillColor('#000');
      y = tableTop + 20;

      const items = order.items || [];
      let subtotal = 0;
      items.forEach((item) => {
        const snap = item.snapshot || {};
        const name = snap.partName || 'Item';
        const partNo = snap.partNumber || '';
        const qty = item.quantity || 1;
        const unitPrice = snap.discountedPrice != null ? snap.discountedPrice : snap.price || 0;
        const lineTotal = qty * unitPrice;
        subtotal += lineTotal;
        const desc = (partNo ? `${name} (${partNo})` : name).substring(0, 35);
        doc.fontSize(9).text(desc, colDesc + 4, y, { width: colQty - colDesc - 4 });
        doc.text(String(qty), colQty + 4, y);
        doc.text(`AED ${Number(unitPrice).toFixed(2)}`, colUnit + 4, y);
        doc.text(`AED ${Number(lineTotal).toFixed(2)}`, colSub + 4, y);
        y += 16;
      });

      y += 8;
      const deliveryCharge = Number(order.deliveryCharge || 0);
      const discount = Number(order.discount || 0);
      const totalPayable = Number(order.totalPayable ?? order.finalPayable ?? 0);
      const totalBeforeVat = Number(order.subtotal ?? order.totalAmount ?? 0) + deliveryCharge - discount;
      const vatAmount = Math.max(0, Math.round((totalPayable - totalBeforeVat) * 100) / 100);

      doc.fontSize(10);
      doc.text(`Subtotal: AED ${Number(order.subtotal ?? order.totalAmount ?? 0).toFixed(2)}`, margin, y);
      y += 14;
      if (deliveryCharge > 0) {
        doc.text(`Delivery: AED ${deliveryCharge.toFixed(2)}`, margin, y);
        y += 14;
      }
      if (order.coupon?.code) {
        doc.text(`Coupon (${order.coupon.code}): -AED ${discount.toFixed(2)}`, margin, y);
        y += 14;
      }
      if (vatAmount > 0) doc.text(`VAT (5%): AED ${vatAmount.toFixed(2)}`, margin, y);
      if (vatAmount > 0) y += 14;
      doc.font('Helvetica-Bold').text(`Total: AED ${totalPayable.toFixed(2)}`, margin, y);
      doc.font('Helvetica');
      y += 20;

      // Amount in words (limit height to avoid flowing to a new page)
      const whole = Math.floor(totalPayable);
      const fils = Math.round((totalPayable - whole) * 100);
      const words = numberToWords(whole);
      doc.fontSize(9).text(`${words} AED AND ${String(fils).padStart(2, '0')} FILS`, margin, y, { width: pageW, height: 28 });
      y += 24;

      // Footer – Premart / company
      const footerY = doc.page.height - 70;
      doc.strokeColor('#ccc').lineWidth(0.5).moveTo(margin, footerY).lineTo(margin + pageW, footerY).stroke();
      doc.fontSize(9).fillColor('#555');
      doc.font('Helvetica-Bold').text('PREMART', margin, footerY + 10);
      doc.font('Helvetica');
      const premartAddr = process.env.PREMART_INVOICE_ADDRESS || 'Premart';
      const premartTRN = process.env.PREMART_TRN || '';
      // doc.text(premartAddr, margin, footerY + 24, { width: pageW });
      // if (premartTRN) doc.text(`TRN: ${premartTRN}`, margin, footerY + 38);
      doc.fillColor('#000');

      
      const isCancelled = (order.status || order.orderStatus || '').toString() === 'Cancelled';
      if (isCancelled) {
        const stampFontSize = 44;
        const stampText = 'CANCELLED';
        const padding = 20;
        doc.font('Helvetica-Bold').fontSize(stampFontSize);
        const textWidth = doc.widthOfString(stampText);
        const boxW = textWidth + padding * 2;
        const boxH = stampFontSize + padding * 2;

        function drawCancelledStamp() {
          const pageCenterX = doc.page.width / 2;
          const pageCenterY = doc.page.height / 2;
          doc.save();
          doc.translate(pageCenterX, pageCenterY);
          doc.rotate(-25);
          doc.opacity(0.85);
          doc.strokeColor('red').lineWidth(3);
          doc.fillColor('red');
          doc.rect(-boxW / 2, -boxH / 2, boxW, boxH).stroke();
          doc.text(stampText, -boxW / 2, -stampFontSize / 3, { width: boxW, align: 'center', lineBreak: false });
          doc.restore();
          doc.fillColor('#000').opacity(1).strokeColor('#000');
        }

        const range = doc.bufferedPageRange();
        for (let i = range.start; i < range.start + range.count; i++) {
          doc.switchToPage(i);
          drawCancelledStamp();
        }
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// Generate Invoice PDF (download response). Protected; same ownership as getOrderById.
exports.generateInvoice = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId).populate('shopId').populate('userId', '_id').lean();
    if (!order) return res.status(404).json({ message: 'Order not found', success: false });

    const role = req.user?.role;
    const requestUserId = (req.user?.id ?? req.user?._id)?.toString();
    const requestShopId = req.user?.shopId?.toString();
    const orderUserId = order.userId?._id?.toString() || order.userId?.toString();
    const orderShopId = order.shopId?._id?.toString() || order.shopId?.toString();
    if (role === 'CUSTOMER' && orderUserId !== requestUserId) {
      return res.status(403).json({ success: false, message: 'You do not have access to this order' });
    }
    if (role === 'SHOP_ADMIN' && orderShopId !== requestShopId) {
      return res.status(403).json({ success: false, message: 'You do not have access to this order' });
    }

    const pdfData = await getInvoicePdfBuffer(order);
    res.setHeader('Content-Disposition', `attachment; filename=Invoice_${order._id}.pdf`);
    res.contentType('application/pdf');
    res.send(pdfData);
  } catch (err) {
    console.error('Invoice generation failed:', err);
    res.status(500).json({ message: 'Failed to generate invoice', success: false, data: err.message });
  }
};

/**
 * Send invoice PDF to customer email. Protected; customer can only request their own order.
 */
exports.sendInvoiceByEmail = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId).populate('shopId').populate('userId', 'email name').lean();
    if (!order) return res.status(404).json({ message: 'Order not found', success: false });

    if (req.user?.role === 'CUSTOMER') {
      const orderUserId = order.userId?._id?.toString() || order.userId?.toString();
      const requestUserId = (req.user?.id ?? req.user?._id)?.toString();
      if (orderUserId !== requestUserId) {
        return res.status(403).json({ success: false, message: 'You do not have access to this order' });
      }
    }

    const email = order.userId?.email || order.deliveryAddress?.contact;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'No valid email for this order' });
    }

    const pdfBuffer = await getInvoicePdfBuffer(order);
    const name = order.userId?.name || order.deliveryAddress?.name || 'Customer';
    const result = await sendOrderInvoiceEmail(email, name, String(order._id), pdfBuffer);
    if (!result.sent) {
      return res.status(503).json({ success: false, message: result.error || 'Failed to send email' });
    }
    return res.status(200).json({ success: true, message: 'Invoice sent to your email' });
  } catch (err) {
    console.error('Send invoice by email failed:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};




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

// Get predefined cancellation reasons for customers
exports.getCancellationReasons = async (req, res) => {
  try {
    const reasons = [
      { id: 1, reason: 'Changed my mind', category: 'customer' },
      { id: 2, reason: 'Found better price elsewhere', category: 'customer' },
      { id: 3, reason: 'Ordered by mistake', category: 'customer' },
      { id: 4, reason: 'Delivery time is too long', category: 'customer' },
      { id: 5, reason: 'Want to change delivery address', category: 'customer' },
      { id: 6, reason: 'Want to change payment method', category: 'customer' },
      { id: 7, reason: 'Product no longer needed', category: 'customer' },
      { id: 8, reason: 'Incorrect product ordered', category: 'customer' },
      { id: 9, reason: 'Financial reasons', category: 'customer' },
      { id: 10, reason: 'Other', category: 'customer' }
    ];

    return res.status(200).json({
      success: true,
      message: 'Cancellation reasons fetched successfully',
      data: reasons
    });
  } catch (error) {
    console.error('Get Cancellation Reasons Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch cancellation reasons',
      error: error.message
    });
  }
};