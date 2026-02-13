// helper/autoAssignHelper.js
const Order = require('../models/Order');
const DeliveryBoy = require('../models/DeliveryBoy');
const geolib = require('geolib');
const mongoose = require('mongoose');

const PER_KM_RATE = 2;

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

exports.autoAssignDeliveryBoyWithin5kmHelper = async (orderId) => {
  try {
    // ✅ FIX: Use mongoose.model() to avoid circular dependency
    const Shop = mongoose.model('Shop');
    
    console.log(`🚀 Auto-assigning delivery boy for order: ${orderId}`);
    console.log(`🔍 Mongoose connected: ${mongoose.connection.readyState === 1 ? 'YES' : 'NO'}`);
    console.log(`🔍 Shop model: ${typeof Shop}`);
    console.log(`🔍 Shop.findById: ${typeof Shop.findById}`);

    // 1️⃣ Find order
    const order = await Order.findById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    if (order.assignedDeliveryBoy) {
      console.log(`⚠️ Order ${orderId} already assigned to ${order.assignedDeliveryBoy}`);
      return { success: false, message: 'Order already assigned' };
    }

    // 2️⃣ Fetch shop
    console.log(`🔍 Fetching shop: ${order.shopId}`);
    
    const shop = await Shop.findById(order.shopId);
    
    if (!shop) {
      throw new Error(`Shop not found for ID: ${order.shopId}`);
    }
    
    console.log(`✅ Shop found: ${shop._id} - ${shop.shopeDetails?.shopName || 'Unnamed'}`);
    
    if (!shop?.shopeDetails?.shopLocation) {
      throw new Error(`Shop ${shop._id} has no location data`);
    }

    // Parse shop coordinates
    const shopLocationString = shop.shopeDetails.shopLocation.toString().trim();
    const coords = shopLocationString.split(',').map(str => str.trim());
    
    if (coords.length !== 2) {
      throw new Error(`Invalid shop location format: ${shopLocationString}`);
    }

    const shopLatitude = parseFloat(coords[0]);
    const shopLongitude = parseFloat(coords[1]);

    if (isNaN(shopLatitude) || isNaN(shopLongitude)) {
      throw new Error(`Could not parse coordinates: ${shopLocationString}`);
    }

    if (shopLatitude < -90 || shopLatitude > 90) {
      throw new Error(`Invalid latitude: ${shopLatitude} (must be between -90 and 90)`);
    }

    if (shopLongitude < -180 || shopLongitude > 180) {
      throw new Error(`Invalid longitude: ${shopLongitude} (must be between -180 and 180)`);
    }

    console.log(`✅ Shop coordinates: lat=${shopLatitude}, lng=${shopLongitude}`);

    // 3️⃣ Fetch available delivery boys
    const deliveryBoys = await DeliveryBoy.find({ availability: true });
    
    if (deliveryBoys.length === 0) {
      throw new Error('No available delivery boys found');
    }

    console.log(`📦 Found ${deliveryBoys.length} available delivery boys`);

    // Get customer coordinates
    const customerLat = order.deliveryAddress.latitude;
    const customerLng = order.deliveryAddress.longitude;

    if (!customerLat || !customerLng || isNaN(customerLat) || isNaN(customerLng)) {
      throw new Error(`Invalid customer coordinates: lat=${customerLat}, lng=${customerLng}`);
    }

    // Calculate distances for all delivery boys
    const deliveryBoysWithDistances = deliveryBoys
      .map(boy => {
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

        const earning = +(dropDistance * PER_KM_RATE).toFixed(2);
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
      throw new Error('No delivery boys with valid coordinates found');
    }

    console.log(`✅ Calculated distances for ${deliveryBoysWithDistances.length} delivery boys`);

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
      const closestDistance = deliveryBoysWithDistances[0]?.pickupDistance || 'N/A';
      throw new Error(`No delivery boy found within 50 km radius. Closest: ${closestDistance} km`);
    }

    // Save delivery details to order
    const firstDeliveryBoy = nearbyDeliveryBoys[0];
    order.deliveryEarning = firstDeliveryBoy.earning;
    order.deliveryDistance = firstDeliveryBoy.dropDistance;
    order.searchRadius = usedRadius;
    order.status = 'Delivery Boy Assigned';
    
    console.log(`💰 Order earnings: ${order.deliveryEarning} AED (${order.deliveryDistance} km)`);
    
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

    console.log(`✅ Order status updated to: Delivery Boy Assigned`);

    // ✅ Emit Socket.IO notifications
    console.log('\n🔔 ========== SOCKET EMISSION START ==========');
    const socketModule = require('../sockets/socket');
    const { getIO, isUserConnected } = socketModule;

    let successfulEmissions = 0;
    let failedEmissions = 0;

    try {
      const io = getIO();
      console.log('✅ Socket.IO instance retrieved');
      console.log(`📋 Connected users: ${Object.keys(socketModule.getConnectedUsers()).length}`);
      
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

      console.log(`📦 Notifying ${nearbyDeliveryBoys.length} delivery boys...`);

      nearbyDeliveryBoys.forEach((boy, index) => {
        const deliveryBoyId = boy._id.toString();
        
        console.log(`📤 [${index + 1}/${nearbyDeliveryBoys.length}] ${boy.name || 'Unknown'} (${deliveryBoyId})`);
        console.log(`   Distance: ${boy.pickupDistance} km | Earning: ${boy.earning} AED`);
        console.log(`   Connected: ${isUserConnected(deliveryBoyId) ? '✅' : '❌'}`);
        
        try {
          io.to(deliveryBoyId).emit('new_order_assigned', emissionData);
          
          if (isUserConnected(deliveryBoyId)) {
            successfulEmissions++;
            console.log(`   ✅ Notification sent successfully`);
          } else {
            failedEmissions++;
            console.log(`   ⚠️ User not connected, notification queued`);
          }
        } catch (emitError) {
          failedEmissions++;
          console.error(`   ❌ Emission failed: ${emitError.message}`);
        }
      });

      console.log(`\n📊 Emission Summary:`);
      console.log(`   ✅ Successful: ${successfulEmissions}`);
      console.log(`   ⚠️ Failed/Queued: ${failedEmissions}`);
      console.log(`   📱 Total: ${nearbyDeliveryBoys.length}`);

    } catch (err) {
      console.error('❌ Socket.IO error:', err.message);
    }

    console.log('🔔 ========== SOCKET EMISSION END ==========\n');

    return {
      success: true,
      message: `Assigned to ${nearbyDeliveryBoys.length} delivery boys within ${usedRadius} km`,
      data: {
        nearbyDeliveryBoys,
        order,
        shop,
        successfulEmissions,
        failedEmissions
      }
    };

  } catch (error) {
    console.error('❌ Auto Assign Helper Error:', error.message);
    console.error('Stack trace:', error.stack);
    throw error;
  }
};