// helper/autoAssignHelper.js
const Order = require('../models/Order');
const DeliveryBoy = require('../models/DeliveryBoy');
const mongoose = require('mongoose');
const { getSuperAdminSettings } = require('./settingsHelper');

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
    // ✅ 1. GET SETTINGS
    const settings = await getSuperAdminSettings();
    const PER_KM_RATE = settings.perKmRate;
    
    const Shop = mongoose.model('Shop');
    const { DeliveryAgency } = mongoose.model('DeliveryAgency');
    
    console.log(`🚀 Auto-assigning delivery boy for order: ${orderId}`);
    console.log(`💰 Using per KM rate: ${PER_KM_RATE} AED from settings`);

    // ✅ 2. Find order
    const order = await Order.findById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    if (order.assignedDeliveryBoy) {
      console.log(`⚠️ Order ${orderId} already assigned`);
      return { success: false, message: 'Order already assigned' };
    }

    // ✅ 3. Fetch shop
    console.log(`🔍 Fetching shop: ${order.shopId}`);
    const shop = await Shop.findById(order.shopId);
    
    if (!shop || !shop?.shopeDetails?.shopLocation) {
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

    console.log(`✅ Shop coordinates: lat=${shopLatitude}, lng=${shopLongitude}`);

    // ✅ 4. **NEW: Get shop's emirate/area**
    const shopCity = shop.shopeDetails.city;
    const shopEmirate = shop.shopeDetails.emirates || shop.shopeDetails.city;
    
    console.log(`📍 Shop location: ${shopCity}, Emirates: ${shopEmirate}`);

    // ✅ 5. Fetch available delivery boys
    const deliveryBoys = await DeliveryBoy.find({ availability: true })
      .populate('agencyId', 'agencyDetails.emirates agencyDetails.city');
    
    if (deliveryBoys.length === 0) {
      throw new Error('No available delivery boys found');
    }

    console.log(`📦 Found ${deliveryBoys.length} available delivery boys`);

    // Get customer coordinates
    const customerLat = order.deliveryAddress.latitude;
    const customerLng = order.deliveryAddress.longitude;

    if (!customerLat || !customerLng) {
      throw new Error(`Invalid customer coordinates`);
    }

    // ✅ 6. **NEW: Filter by Emirates FIRST**
    const emiratesFilteredBoys = deliveryBoys.filter(boy => {
      if (!boy.agencyId || !boy.agencyId.agencyDetails) {
        console.warn(`⚠️ Delivery boy ${boy._id} has no agency - skipping`);
        return false;
      }

      const agencyEmirates = boy.agencyId.agencyDetails.emirates;
      
      // Check if agency operates in shop's emirate
      if (Array.isArray(agencyEmirates)) {
        const operates = agencyEmirates.some(emirate => 
          emirate.toLowerCase() === shopEmirate.toLowerCase() ||
          emirate.toLowerCase() === shopCity.toLowerCase()
        );
        
        if (!operates) {
          console.log(`⚠️ Skipping ${boy.name} - Agency doesn't operate in ${shopEmirate}`);
        }
        
        return operates;
      }
      
      return false;
    });

    console.log(`✅ After emirates filter: ${emiratesFilteredBoys.length} delivery boys`);

    if (emiratesFilteredBoys.length === 0) {
      throw new Error(`No delivery boys found operating in ${shopEmirate} emirate`);
    }

    // ✅ 7. Calculate distances for emirates-filtered boys
    const deliveryBoysWithDistances = emiratesFilteredBoys
      .map(boy => {
        if (!boy.latitude || !boy.longitude) {
          console.warn(`⚠️ Skipping ${boy.name} - no coordinates`);
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

    console.log(`✅ Calculated distances for ${deliveryBoysWithDistances.length} boys`);

    // ✅ 8. FALLBACK RADIUS LOGIC
    const radiusOptions = settings.deliveryAssignmentRadius || [3, 5, 10, 50];
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
      throw new Error(`No delivery boy found within 50 km in ${shopEmirate}. Closest: ${closestDistance} km`);
    }

    // ✅ 9. Save delivery details to order
    const firstDeliveryBoy = nearbyDeliveryBoys[0];
    order.deliveryEarning = firstDeliveryBoy.earning;
    order.deliveryDistance = firstDeliveryBoy.dropDistance;
    order.searchRadius = usedRadius;
    order.status = 'Delivery Boy Assigned';
    
    console.log(`💰 Order earnings: ${order.deliveryEarning} AED (${order.deliveryDistance} km)`);
    
    await order.save();

    await Order.findByIdAndUpdate(order._id, {
      $push: {
        statusHistory: {
          status: 'Delivery Boy Assigned',
          date: new Date()
        }
      }
    });

    console.log(`✅ Order status updated to: Delivery Boy Assigned`);

    // ✅ 10. Emit Socket.IO notifications
    console.log('\n🔔 ========== SOCKET EMISSION START ==========');
    const socketModule = require('../sockets/socket');
    const { getIO, isUserConnected } = socketModule;

    let successfulEmissions = 0;
    let failedEmissions = 0;

    try {
      const io = getIO();
      console.log('✅ Socket.IO instance retrieved');
      
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

      console.log(`📤 Notifying ${nearbyDeliveryBoys.length} delivery boys...`);

      nearbyDeliveryBoys.forEach((boy, index) => {
        const deliveryBoyId = boy._id.toString();
        
        console.log(`📤 [${index + 1}/${nearbyDeliveryBoys.length}] ${boy.name || 'Unknown'} (${deliveryBoyId})`);
        console.log(`   Emirates: ${boy.agencyId?.agencyDetails?.emirates?.join(', ')}`);
        console.log(`   Distance: ${boy.pickupDistance} km | Earning: ${boy.earning} AED`);
        
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

    } catch (err) {
      console.error('❌ Socket.IO error:', err.message);
    }

    console.log('🔔 ========== SOCKET EMISSION END ==========\n');

    return {
      success: true,
      message: `Assigned to ${nearbyDeliveryBoys.length} delivery boys within ${usedRadius} km (${shopEmirate} emirate)`,
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