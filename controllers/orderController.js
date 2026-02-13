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
    const { couponCode, paymentType, transactionId } = req.body;
    const userId = req.user?._id || req.params.userId;
    
    if (!userId) {
      return res.status(400).json({ 
        message: 'User ID is required', 
        success: false 
      });
    }

    // ========================
    // 1. GET USER DATA
    // ========================
    const User = require('../models/User');
    const userData = await User.findById(userId);
    
    if (!userData) {
      return res.status(400).json({ 
        message: 'User not found', 
        success: false 
      });
    }

    // ========================
    // 2. RESOLVE DELIVERY ADDRESS
    // ========================
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
        return res.status(400).json({ 
          message: 'No delivery address found', 
          success: false 
        });
      }
      deliveryAddress = {
        ...defaultAddress.toObject(),
        latitude: defaultAddress.latitude || userData.latitude,
        longitude: defaultAddress.longitude || userData.longitude,
      };
    }

    // ========================
    // 3. FETCH CART
    // ========================
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
      return res.status(400).json({ 
        message: 'Cart is empty', 
        success: false 
      });
    }

    // ========================
    // 4. NORMALIZE CART ITEMS
    // ========================
    const allProducts = cart.items.map(item => ({
      shopProductId: item.shopProductId._id,
      shopId: item.shopProductId.shopId,
      price: item.shopProductId.discountedPrice || item.shopProductId.price,
      quantity: item.quantity,
      part: item.shopProductId.part
    }));

    // ========================
    // 5. GROUP BY SHOP
    // ========================
    const productsByShop = {};
    allProducts.forEach(p => {
      const sId = p.shopId.toString();
      if (!productsByShop[sId]) productsByShop[sId] = [];
      productsByShop[sId].push(p);
    });

    // ========================
    // 6. CALCULATE TOTALS
    // ========================
    let originalTotal = 0;
    for (const p of allProducts) {
      originalTotal += p.price * p.quantity;
    }

    // ========================
    // 7. APPLY COUPON
    // ========================
    let couponDiscount = 0;
    let appliedCoupon = null;

    if (couponCode) {
      const coupon = await Coupon.findOne({ 
        code: couponCode, 
        isActive: true 
      });

      if (!coupon) {
        return res.status(400).json({ 
          message: 'Invalid coupon', 
          success: false 
        });
      }

      // Check expiry
      if (coupon.expiryDate && new Date() > coupon.expiryDate) {
        return res.status(400).json({ 
          message: 'Coupon has expired', 
          success: false 
        });
      }

      // Check usage limit
      if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
        return res.status(400).json({ 
          message: 'Coupon usage limit reached', 
          success: false 
        });
      }

      // Check minimum order amount
      if (coupon.minOrderAmount && originalTotal < coupon.minOrderAmount) {
        return res.status(400).json({ 
          message: `Minimum order amount is ${coupon.minOrderAmount}`, 
          success: false 
        });
      }

      // Calculate discount
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

      // Update coupon usage
      coupon.usedCount += 1;
      if (!coupon.userId) coupon.userId = [];
      coupon.userId.push(userId);
      await coupon.save();
    }

    const totalDiscount = couponDiscount;
    const totalAmount = +(originalTotal - totalDiscount).toFixed(2);
    
    // Master delivery charge (applies to entire order if < 500)
    const deliverycharge = originalTotal < 500;
    const masterDeliveryCharge = deliverycharge ? 30 : 0;
    const finalPayable = totalAmount + masterDeliveryCharge;
// ========================
    // 8. CREATE MASTER ORDER
    // ========================
    const masterOrder = await MasterOrder.create({
      userId,
      totalAmount: originalTotal,
      finalPayable,
      deliverycharge: masterDeliveryCharge,
      couponApplied: appliedCoupon ? {
        ...appliedCoupon,
        discountAmount: totalDiscount
      } : null
    });

    console.log(`✅ Master order created: ${masterOrder._id}`);

    // ========================
    // 9. CREATE PER-SHOP ORDERS
    // ========================
    const perShopResults = [];

    for (const shopId of Object.keys(productsByShop)) {
      const shop = await Shop.findById(shopId);
      const shopProducts = productsByShop[shopId];

      // Calculate shop subtotal
      let shopTotal = 0;
      shopProducts.forEach(p => {
        shopTotal += p.price * p.quantity;
      });

      // Calculate proportional discount
      let shopDiscount = 0;
      if (couponDiscount > 0 && originalTotal > 0) {
        shopDiscount = +(couponDiscount * (shopTotal / originalTotal)).toFixed(2);
      }

      // Calculate delivery distance and earning
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
          deliveryEarning = +(PER_KM_RATE * deliveryDistance).toFixed(2);
          
          console.log(`📍 Shop ${shopId}: Distance ${deliveryDistance} km, Earning ${deliveryEarning} AED`);
        }
      }

      const shopDeliveryCharge = deliverycharge ? 30 : 0;
      const shopFinalPayable = shopTotal - shopDiscount + shopDeliveryCharge;

      // Reduce stock
      for (const p of shopProducts) {
        await ShopProduct.findByIdAndUpdate(p.shopProductId, {
          $inc: { stock: -p.quantity }
        });
      }

      // Create order
      const createdOrder = await Order.create({
        userId,
        shopId,
        masterOrderId: masterOrder._id,
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
              price: p.price,
              discountedPrice: null,
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
        statusHistory: [
          { status: 'Pending', date: new Date() }
        ]
      });

      console.log(`✅ Order created for shop ${shopId}: ${createdOrder._id}`);

      // Add order to shop
      await Shop.findByIdAndUpdate(
        shopId,
        {
          $push: {
            orders: { orderId: createdOrder._id }
          }
        }
      );

      perShopResults.push(createdOrder);
    }

    // ✅✅ FIX: Move this OUTSIDE the loop - AFTER all orders are created
    await MasterOrder.findByIdAndUpdate(
      masterOrder._id,
      {
        $set: {
          orderIds: perShopResults.map(o => o._id)  // ✅ Use $set instead of $push
        }
      }
    );

    console.log(`✅ Added ${perShopResults.length} order IDs to master order ${masterOrder._id}`);

    // ========================
    // 10. CLEAR CART
    // ========================
    await Cart.updateOne({ userId }, { $set: { items: [] } });

    // ========================
    // 11. RETURN RESPONSE
    // ========================
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
    res.status(500).json({
      message: 'Failed to place order',
      success: false,
      error: err.message
    });
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

    console.log('✅ Order found:', order._id);
    console.log('📦 Order items:', JSON.stringify(order.items, null, 2));

    // Format response with correct field names matching Flutter expectations
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
      deliverycharge: order.deliveryCharge > 0,
      deliveryEarning: order.deliveryEarning || 0,
      additionalcharges: 0,
      
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
      
      // ✅ FIX: Properly format items with images
      items: order.items?.map(item => {
        console.log('🔍 Processing item:', item.shopProductId?._id);
        console.log('📸 Snapshot image:', item.snapshot?.image);
        console.log('📸 Part images:', item.shopProductId?.part?.images);
        
        return {
          shopProductId: item.shopProductId?._id,
          quantity: item.quantity,
          partName: item.snapshot?.partName || item.shopProductId?.part?.partName || 'Product',
          partNumber: item.snapshot?.partNumber || item.shopProductId?.part?.partNumber,
          price: item.snapshot?.price || 0,
          // ✅ Include images from both snapshot and populated part
          images: item.snapshot?.image 
            ? [item.snapshot.image] 
            : (item.shopProductId?.part?.images || []),
          snapshot: item.snapshot, // Keep full snapshot for reference
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

    console.log('✅ Formatted order response');
    console.log('💰 Total Amount:', formattedOrder.totalAmount);
    console.log('💰 Final Payable:', formattedOrder.finalPayable);
    console.log('📦 Items count:', formattedOrder.items.length);
    console.log('🖼️ First item images:', formattedOrder.items[0]?.images);

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
        // ✅ UPDATED: Populate delivery boy with agency details
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
      
      // ✅ Extract delivery boy and agency information
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
        agencyName: agencyName, // ✅ NEW: Agency name
        
        // Shop
        shopName: order.shopId?.shopeDetails?.shopName || 'Unknown Shop',
        shopAddress: order.shopId?.shopeDetails?.shopAddress || '-',
        emiratesIdImage: order.shopId?.shopeDetails?.EmiratesIdImage || null,
        orderCount: orderCount,
        
        // Payment
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

    // Get latest order date
    const latestOrderDate = orders.length > 0 
      ? orders[0].createdAt 
      : null;

    const formattedLatestDate = latestOrderDate
      ? new Date(latestOrderDate).toLocaleString('en-IN', {
          timeZone: 'Asia/Dubai',
          year: 'numeric',
          month: 'short',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        })
      : null;

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
      .lean();

    const formatted = orders.map(order => ({
      orderId: order._id,
      shop: order.shopId?.shopeDetails?.shopName,
      status: order.status,
      totalPayable: order.totalPayable,
      createdAt: order.createdAt,
      items: order.items.map(i => ({
        quantity: i.quantity,
        ...i.snapshot
      }))
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
        .sort({ createdAt: -1 })
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
      // Emit to the delivery boy's room
      io.to(deliveryBoyId).emit('new_order_assigned', emissionData);
      console.log(`   ✅ Emission sent to room: ${deliveryBoyId}`);
      
      if (isUserConnected(deliveryBoyId)) {
        successfulEmissions++;
      } else {
        console.log(`   ⚠️ Warning: User not in connected list, but emission attempted`);
        failedEmissions++;
      }
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