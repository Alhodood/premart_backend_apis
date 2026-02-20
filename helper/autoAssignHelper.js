// helper/autoAssignHelper.js
const Order = require('../models/Order');
const DeliveryBoy = require('../models/DeliveryBoy');
const mongoose = require('mongoose');
const { getSuperAdminSettings } = require('./settingsHelper');

// ══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ══════════════════════════════════════════════════════════════════════════

/**
 * Calculate distance between two GPS coordinates (Haversine formula)
 * Returns distance in kilometers
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
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

/**
 * Determine emirate from coordinates using approximate bounding boxes
 * This is a simplified approach - in production, use a proper geocoding API
 */
function getEmirateFromCoordinates(latitude, longitude) {
  // Approximate emirate boundaries (bounding boxes)
  const emiratesBoundaries = {
    'Dubai': {
      minLat: 24.8, maxLat: 25.4,
      minLng: 54.9, maxLng: 55.6
    },
    'Sharjah': {
      minLat: 25.2, maxLat: 25.5,
      minLng: 55.3, maxLng: 55.7
    },
    'Abu Dhabi': {
      minLat: 24.2, maxLat: 24.6,
      minLng: 54.3, maxLng: 54.8
    },
    'Ajman': {
      minLat: 25.3, maxLat: 25.5,
      minLng: 55.4, maxLng: 55.6
    },
    'Ras Al Khaimah': {
      minLat: 25.6, maxLat: 26.0,
      minLng: 55.7, maxLng: 56.2
    },
    'Fujairah': {
      minLat: 25.1, maxLat: 25.5,
      minLng: 56.3, maxLng: 56.4
    },
    'Umm Al Quwain': {
      minLat: 25.5, maxLat: 25.6,
      minLng: 55.5, maxLng: 55.7
    }
  };

  // Check which emirate the coordinates fall into
  for (const [emirate, bounds] of Object.entries(emiratesBoundaries)) {
    if (
      latitude >= bounds.minLat && latitude <= bounds.maxLat &&
      longitude >= bounds.minLng && longitude <= bounds.maxLng
    ) {
      return emirate;
    }
  }

  // Default to Dubai if unable to determine
  console.warn(`⚠️ Unable to determine emirate for coordinates (${latitude}, ${longitude}). Defaulting to Dubai.`);
  return 'Dubai';
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN AUTO-ASSIGNMENT FUNCTION
// ══════════════════════════════════════════════════════════════════════════

exports.autoAssignDeliveryBoyWithin5kmHelper = async (orderId) => {
  try {
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 1: INITIALIZE & FETCH SETTINGS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    const settings = await getSuperAdminSettings();
    const PER_KM_RATE = settings.perKmRate || 5;
    const RADIUS_OPTIONS = settings.deliveryAssignmentRadius || [3, 5, 10, 50];
    
    const { Shop } = require('../models/Shop'); 
    
    console.log('\n' + '═'.repeat(70));
    console.log('🚀 AUTO-ASSIGNMENT STARTED');
    console.log('═'.repeat(70));
    console.log(`📦 Order ID: ${orderId}`);
    console.log(`💰 Per KM Rate: ${PER_KM_RATE} AED`);
    console.log(`📍 Radius Options: ${RADIUS_OPTIONS.join('km, ')}km`);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 2: FETCH ORDER
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    const order = await Order.findById(orderId);
    if (!order) {
      throw new Error('❌ Order not found');
    }

    if (order.assignedDeliveryBoy) {
      console.log(`⚠️ Order ${orderId} already assigned to delivery boy: ${order.assignedDeliveryBoy}`);
      return { success: false, message: 'Order already assigned' };
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 3: FETCH SHOP & VALIDATE LOCATION
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    console.log(`\n🔍 Fetching shop: ${order.shopId}`);
    const shop = await Shop.findById(order.shopId);
    
    if (!shop || !shop.shopeDetails?.shopLocation) {
      throw new Error(`❌ Shop ${order.shopId} has no location data`);
    }

    // Parse shop coordinates
    const shopLocationString = shop.shopeDetails.shopLocation.toString().trim();
    const coords = shopLocationString.split(',').map(str => parseFloat(str.trim()));
    
    if (coords.length !== 2 || isNaN(coords[0]) || isNaN(coords[1])) {
      throw new Error(`❌ Invalid shop coordinates: ${shopLocationString}`);
    }

    const [shopLatitude, shopLongitude] = coords;
    console.log(`✅ Shop coordinates: (${shopLatitude}, ${shopLongitude})`);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 4: DETERMINE SHOP'S EMIRATE FROM COORDINATES
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    let shopEmirate = getEmirateFromCoordinates(shopLatitude, shopLongitude);
    
    // Fallback to database emirates if set
    if (shop.shopeDetails.emirates) {
      shopEmirate = shop.shopeDetails.emirates;
      console.log(`📍 Shop emirate (from DB): ${shopEmirate}`);
    } else {
      console.log(`📍 Shop emirate (from coordinates): ${shopEmirate}`);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 5: GET CUSTOMER COORDINATES
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    const customerLat = order.deliveryAddress?.latitude;
    const customerLng = order.deliveryAddress?.longitude;

    if (!customerLat || !customerLng) {
      throw new Error(`❌ Invalid customer coordinates`);
    }

    console.log(`🏠 Customer coordinates: (${customerLat}, ${customerLng})`);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 6: FETCH AVAILABLE DELIVERY BOYS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    console.log(`\n🔍 Searching for available delivery boys...`);
    
    const deliveryBoys = await DeliveryBoy.find({ 
      availability: true,
      isOnline: true 
    }).populate('agencyId', 'agencyDetails.emirates agencyDetails.agencyName');
    
    if (deliveryBoys.length === 0) {
      throw new Error('❌ No available delivery boys found');
    }

    console.log(`✅ Found ${deliveryBoys.length} available delivery boys`);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 7: FILTER BY EMIRATE COVERAGE (SMART LOGIC)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    console.log(`\n🌍 Filtering by emirate coverage...`);
    
    const emiratesFilteredBoys = deliveryBoys.filter(boy => {
      // Skip if no agency
      if (!boy.agencyId || !boy.agencyId.agencyDetails) {
        console.warn(`⚠️ ${boy.name} has no agency - skipping`);
        return false;
      }

      const agencyEmirates = boy.agencyId.agencyDetails.emirates;
      
      // If agency has no emirates set, include them (no restriction)
      if (!agencyEmirates || !Array.isArray(agencyEmirates) || agencyEmirates.length === 0) {
        console.log(`✅ ${boy.name} (${boy.agencyId.agencyDetails.agencyName}) - No emirate restriction`);
        return true;
      }
      
      // Check if agency operates in shop's emirate
      const operates = agencyEmirates.some(emirate => 
        emirate.toLowerCase() === shopEmirate.toLowerCase()
      );
      
      if (operates) {
        console.log(`✅ ${boy.name} (${boy.agencyId.agencyDetails.agencyName}) - Operates in ${shopEmirate}`);
      } else {
        console.log(`❌ ${boy.name} (${boy.agencyId.agencyDetails.agencyName}) - Doesn't operate in ${shopEmirate}`);
      }
      
      return operates;
    });

    console.log(`\n📊 After emirate filter: ${emiratesFilteredBoys.length}/${deliveryBoys.length} delivery boys`);

    if (emiratesFilteredBoys.length === 0) {
      throw new Error(`❌ No delivery boys available for ${shopEmirate} emirate`);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 8: CALCULATE DISTANCES & EARNINGS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    console.log(`\n📏 Calculating distances...`);
    
    const deliveryBoysWithDistances = emiratesFilteredBoys
      .map(boy => {
        if (!boy.latitude || !boy.longitude) {
          console.warn(`⚠️ ${boy.name} has no coordinates - skipping`);
          return null;
        }

        // Distance from delivery boy to shop (pickup)
        const pickupDistance = calculateDistance(
          boy.latitude,
          boy.longitude,
          shopLatitude,
          shopLongitude
        );

        // Distance from shop to customer (drop)
        const dropDistance = calculateDistance(
          shopLatitude,
          shopLongitude,
          customerLat,
          customerLng
        );

        // Total delivery distance
        const totalDistance = pickupDistance + dropDistance;

        // Earnings calculated on drop distance only
        const earning = +(dropDistance * PER_KM_RATE).toFixed(2);
        
        // Estimated times (assuming 30 km/h average speed)
        const pickupTime = Math.ceil((pickupDistance / 30) * 60);
        const dropTime = Math.ceil((dropDistance / 30) * 60);
        const totalTime = pickupTime + dropTime;

        console.log(`  📍 ${boy.name}:`);
        console.log(`     Pickup: ${pickupDistance.toFixed(2)} km (${pickupTime} mins)`);
        console.log(`     Drop: ${dropDistance.toFixed(2)} km (${dropTime} mins)`);
        console.log(`     Total: ${totalDistance.toFixed(2)} km (${totalTime} mins)`);
        console.log(`     Earning: ${earning} AED`);

        return {
          ...boy._doc,
          pickupDistance: +pickupDistance.toFixed(2),
          dropDistance: +dropDistance.toFixed(2),
          totalDistance: +totalDistance.toFixed(2),
          pickupTime: `${pickupTime} mins`,
          dropTime: `${dropTime} mins`,
          totalTime: `${totalTime} mins`,
          earning
        };
      })
      .filter(boy => boy !== null)
      .sort((a, b) => a.pickupDistance - b.pickupDistance); // Sort by nearest pickup

    console.log(`\n✅ Calculated distances for ${deliveryBoysWithDistances.length} delivery boys`);

    if (deliveryBoysWithDistances.length === 0) {
      throw new Error('❌ No delivery boys with valid coordinates');
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 9: PROGRESSIVE RADIUS SEARCH
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    console.log(`\n🎯 Progressive radius search...`);
    
    let nearbyDeliveryBoys = [];
    let usedRadius = 0;

    for (const radius of RADIUS_OPTIONS) {
      nearbyDeliveryBoys = deliveryBoysWithDistances.filter(
        boy => boy.pickupDistance <= radius
      );

      console.log(`  ${radius}km radius: ${nearbyDeliveryBoys.length} delivery boys found`);

      if (nearbyDeliveryBoys.length > 0) {
        usedRadius = radius;
        console.log(`✅ Selected ${nearbyDeliveryBoys.length} delivery boys within ${radius} km`);
        break;
      }
    }

    if (nearbyDeliveryBoys.length === 0) {
      const closestDistance = deliveryBoysWithDistances[0]?.pickupDistance || 'N/A';
      throw new Error(`❌ No delivery boy found within ${RADIUS_OPTIONS[RADIUS_OPTIONS.length - 1]} km. Closest: ${closestDistance} km`);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 10: UPDATE ORDER WITH DELIVERY DETAILS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    console.log(`\n💾 Updating order...`);
    
    const firstDeliveryBoy = nearbyDeliveryBoys[0];
    
    // Set agency ID from first delivery boy
    if (firstDeliveryBoy.agencyId) {
      order.agencyId = firstDeliveryBoy.agencyId._id;
      console.log(`🏢 Agency: ${firstDeliveryBoy.agencyId.agencyDetails.agencyName} (${firstDeliveryBoy.agencyId._id})`);
    } else {
      console.warn(`⚠️ Warning: ${firstDeliveryBoy.name} has no agencyId!`);
    }
    
    order.deliveryEarning = firstDeliveryBoy.earning;
    order.deliveryDistance = firstDeliveryBoy.dropDistance;
    order.searchRadius = usedRadius;
    order.status = 'Delivery Boy Assigned';
    
    console.log(`💰 Delivery earning: ${order.deliveryEarning} AED`);
    console.log(`📏 Delivery distance: ${order.deliveryDistance} km`);
    console.log(`🎯 Search radius used: ${usedRadius} km`);
    
    await order.save();

    // Add to status history
    await Order.findByIdAndUpdate(order._id, {
      $push: {
        statusHistory: {
          status: 'Delivery Boy Assigned',
          date: new Date()
        }
      }
    });

    console.log(`✅ Order updated successfully`);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 11: NOTIFY ALL NEARBY DELIVERY BOYS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    console.log(`\n🔔 Sending notifications...`);
    console.log('═'.repeat(70));
    
    const socketModule = require('../sockets/socket');
    const { getIO, isUserConnected } = socketModule;

    let successfulEmissions = 0;
    let failedEmissions = 0;

    try {
      const io = getIO();
      
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
            shopeDetails: {
    shopName: shop.shopeDetails.shopName,
    shopAddress: shop.shopeDetails.shopAddress || '',
    shopContact: shop.shopeDetails.shopContact || '',
    shopLocation: shop.shopeDetails.shopLocation || '',
  },
            location: {
              latitude: shopLatitude,
              longitude: shopLongitude
            }
          },
          customer: {
            location: {
              latitude: customerLat,
              longitude: customerLng
            },
            address: order.deliveryAddress
          }
        }
      };

      console.log(`📤 Notifying ${nearbyDeliveryBoys.length} delivery boys...`);

      for (let index = 0; index < nearbyDeliveryBoys.length; index++) {
        const boy = nearbyDeliveryBoys[index];
        const deliveryBoyId = boy._id.toString();
        
        console.log(`\n  [${index + 1}/${nearbyDeliveryBoys.length}] ${boy.name || 'Unknown'}`);
        console.log(`     ID: ${deliveryBoyId}`);
        console.log(`     Distance: ${boy.pickupDistance} km (pickup), ${boy.dropDistance} km (drop)`);
        console.log(`     Earning: ${boy.earning} AED`);
        console.log(`     Est. Time: ${boy.totalTime}`);
        
        try {
          // Socket.IO notification
          io.to(deliveryBoyId).emit('new_order_assigned', emissionData);
          
          // Push notification
          const { sendPushOnly } = require('../helper/notificationHelper');
          sendPushOnly(
            deliveryBoyId, 
            'New Order Assigned', 
            `Pickup: ${boy.pickupDistance}km away. Earning: ${boy.earning} AED`, 
            {
              route: 'order_assigned',
              order_id: order._id.toString()
            }
          ).catch(() => {});
          
          if (isUserConnected(deliveryBoyId)) {
            successfulEmissions++;
            console.log(`     ✅ Notification sent (online)`);
          } else {
            failedEmissions++;
            console.log(`     ⚠️ Notification queued (offline)`);
          }
        } catch (emitError) {
          failedEmissions++;
          console.error(`     ❌ Emission failed: ${emitError.message}`);
        }
      }

      console.log(`\n📊 Notification Summary:`);
      console.log(`   ✅ Successful: ${successfulEmissions}`);
      console.log(`   ⚠️ Failed/Queued: ${failedEmissions}`);
      console.log(`   📱 Total notified: ${nearbyDeliveryBoys.length}`);

    } catch (err) {
      console.error('❌ Socket.IO error:', err.message);
    }

    console.log('═'.repeat(70));
    console.log('✅ AUTO-ASSIGNMENT COMPLETED SUCCESSFULLY');
    console.log('═'.repeat(70) + '\n');

    return {
      success: true,
      message: `Assigned to ${nearbyDeliveryBoys.length} delivery boys within ${usedRadius} km (${shopEmirate} emirate)`,
      data: {
        nearbyDeliveryBoys,
        order,
        shop,
        successfulEmissions,
        failedEmissions,
        emirate: shopEmirate,
        radiusUsed: usedRadius
      }
    };

  } catch (error) {
    console.error('\n' + '═'.repeat(70));
    console.error('❌ AUTO-ASSIGNMENT FAILED');
    console.error('═'.repeat(70));
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    console.error('═'.repeat(70) + '\n');
    throw error;
  }
};

exports.getEmirateFromCoordinates = getEmirateFromCoordinates;