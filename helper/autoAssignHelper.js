const Order = require('../models/Order');
const DeliveryBoy = require('../models/DeliveryBoy');
const mongoose = require('mongoose');
const { getSuperAdminSettings } = require('./settingsHelper');

// ══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ══════════════════════════════════════════════════════════════════════════

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

function getEmirateFromCoordinates(latitude, longitude) {
  const emiratesBoundaries = {
    Dubai:            { minLat: 24.8, maxLat: 25.4, minLng: 54.9, maxLng: 55.6 },
    Sharjah:          { minLat: 25.2, maxLat: 25.5, minLng: 55.3, maxLng: 55.7 },
    'Abu Dhabi':      { minLat: 24.2, maxLat: 24.6, minLng: 54.3, maxLng: 54.8 },
    Ajman:            { minLat: 25.3, maxLat: 25.5, minLng: 55.4, maxLng: 55.6 },
    'Ras Al Khaimah': { minLat: 25.6, maxLat: 26.0, minLng: 55.7, maxLng: 56.2 },
    Fujairah:         { minLat: 25.1, maxLat: 25.5, minLng: 56.3, maxLng: 56.4 },
    'Umm Al Quwain':  { minLat: 25.5, maxLat: 25.6, minLng: 55.5, maxLng: 55.7 },
  };

  for (const [emirate, bounds] of Object.entries(emiratesBoundaries)) {
    if (
      latitude  >= bounds.minLat && latitude  <= bounds.maxLat &&
      longitude >= bounds.minLng && longitude <= bounds.maxLng
    ) {
      return emirate;
    }
  }

  console.warn(
    `⚠️ Unable to determine emirate for coordinates (${latitude}, ${longitude}). Defaulting to Dubai.`
  );
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
    const PER_KM_RATE    = settings.perKmRate || 5;
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
      console.log(`⚠️ Order ${orderId} already assigned to: ${order.assignedDeliveryBoy}`);
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

    const shopLocationString = shop.shopeDetails.shopLocation.toString().trim();
    const coords = shopLocationString.split(',').map((str) => parseFloat(str.trim()));

    if (coords.length !== 2 || isNaN(coords[0]) || isNaN(coords[1])) {
      throw new Error(`❌ Invalid shop coordinates: ${shopLocationString}`);
    }

    const [shopLatitude, shopLongitude] = coords;
    console.log(`✅ Shop coordinates: (${shopLatitude}, ${shopLongitude})`);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 4: DETERMINE SHOP'S EMIRATE
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    let shopEmirate = getEmirateFromCoordinates(shopLatitude, shopLongitude);

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
    //
    // ✅ REMOVED: isOnline: true filter
    //    Delivery boys should receive order notifications regardless of
    //    online status. They can go online and accept when they see it.
    //
    // ✅ REMOVED: accountVerify filter
    //    Verification should not block order assignment. Admins manage
    //    verification separately; delivery boys still need to work.
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    console.log(`\n🔍 Searching for available delivery boys...`);

    const deliveryBoys = await DeliveryBoy.find({
      latitude:  { $exists: true, $ne: null },
      longitude: { $exists: true, $ne: null },
    }).populate('agencyId', 'agencyDetails.emirates agencyDetails.agencyName');

    if (deliveryBoys.length === 0) {
      console.log(`⚠️ No delivery boys found — order ${orderId} remains Pending`);
      return {
        success: false,
        message: 'No delivery boys available. Order kept as Pending.',
        orderId,
      };
    }

    console.log(`✅ Found ${deliveryBoys.length} available delivery boys`);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 7: FILTER BY EMIRATE COVERAGE
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    console.log(`\n🌍 Filtering by emirate coverage...`);

    const emiratesFilteredBoys = deliveryBoys.filter((boy) => {
      if (!boy.agencyId || !boy.agencyId.agencyDetails) {
        console.warn(`⚠️ ${boy.name} has no agency - skipping`);
        return false;
      }

      const agencyEmirates = boy.agencyId.agencyDetails.emirates;

      if (!agencyEmirates || !Array.isArray(agencyEmirates) || agencyEmirates.length === 0) {
        console.log(`✅ ${boy.name} (${boy.agencyId.agencyDetails.agencyName}) - No emirate restriction`);
        return true;
      }

      // ✅ FIX: shopEmirate could be array (from shop.shopeDetails.emirates)
      //         Normalise to string before comparison
      const shopEmirateStr = Array.isArray(shopEmirate)
        ? shopEmirate[0] || ''
        : shopEmirate;

      const operates = agencyEmirates.some(
        (emirate) => emirate.toLowerCase() === shopEmirateStr.toLowerCase()
      );

      if (operates) {
        console.log(`✅ ${boy.name} (${boy.agencyId.agencyDetails.agencyName}) - Operates in ${shopEmirateStr}`);
      } else {
        console.log(`❌ ${boy.name} (${boy.agencyId.agencyDetails.agencyName}) - Doesn't operate in ${shopEmirateStr}`);
      }

      return operates;
    });

    console.log(`\n📊 After emirate filter: ${emiratesFilteredBoys.length}/${deliveryBoys.length} delivery boys`);

    if (emiratesFilteredBoys.length === 0) {
      console.log(`⚠️ No delivery boys cover emirate '${shopEmirate}' — order ${orderId} remains Pending`);
      return {
        success: false,
        message: `No delivery boys available for ${shopEmirate}. Order kept as Pending.`,
        orderId,
      };
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 8: CALCULATE DISTANCES & EARNINGS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    console.log(`\n📏 Calculating distances...`);

    const deliveryBoysWithDistances = emiratesFilteredBoys
      .map((boy) => {
        if (!boy.latitude || !boy.longitude) {
          console.warn(`⚠️ ${boy.name} has no coordinates - skipping`);
          return null;
        }

        const pickupDistance = calculateDistance(
          boy.latitude, boy.longitude,
          shopLatitude,  shopLongitude
        );

        const dropDistance = calculateDistance(
          shopLatitude,  shopLongitude,
          customerLat,   customerLng
        );

        const totalDistance = pickupDistance + dropDistance;
        const earning       = +(dropDistance * PER_KM_RATE).toFixed(2);
        const pickupTime    = Math.ceil((pickupDistance / 30) * 60);
        const dropTime      = Math.ceil((dropDistance / 30) * 60);
        const totalTime     = pickupTime + dropTime;

        console.log(`  📍 ${boy.name}:`);
        console.log(`     Pickup: ${pickupDistance.toFixed(2)} km (${pickupTime} mins)`);
        console.log(`     Drop: ${dropDistance.toFixed(2)} km (${dropTime} mins)`);
        console.log(`     Total: ${totalDistance.toFixed(2)} km (${totalTime} mins)`);
        console.log(`     Earning: ${earning} AED`);

        return {
          ...boy._doc,
          pickupDistance: +pickupDistance.toFixed(2),
          dropDistance:   +dropDistance.toFixed(2),
          totalDistance:  +totalDistance.toFixed(2),
          pickupTime:     `${pickupTime} mins`,
          dropTime:       `${dropTime} mins`,
          totalTime:      `${totalTime} mins`,
          earning,
        };
      })
      .filter((boy) => boy !== null)
      .sort((a, b) => a.pickupDistance - b.pickupDistance);

    console.log(`\n✅ Calculated distances for ${deliveryBoysWithDistances.length} delivery boys`);

    if (deliveryBoysWithDistances.length === 0) {
      console.log(`⚠️ All filtered delivery boys have no coordinates — order ${orderId} remains Pending`);
      return {
        success: false,
        message: 'Delivery boys found but none have valid coordinates. Order kept as Pending.',
        orderId,
      };
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 9: PROGRESSIVE RADIUS SEARCH
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    console.log(`\n🎯 Progressive radius search...`);

    let nearbyDeliveryBoys = [];
    let usedRadius = 0;

    for (const radius of RADIUS_OPTIONS) {
      nearbyDeliveryBoys = deliveryBoysWithDistances.filter(
        (boy) => boy.pickupDistance <= radius
      );

      console.log(`  ${radius}km radius: ${nearbyDeliveryBoys.length} delivery boys found`);

      if (nearbyDeliveryBoys.length > 0) {
        usedRadius = radius;
        console.log(`✅ Selected ${nearbyDeliveryBoys.length} delivery boys within ${radius} km`);
        break;
      }
    }

    if (nearbyDeliveryBoys.length === 0) {
      const closestDistance = deliveryBoysWithDistances[0]?.pickupDistance ?? 'N/A';
      console.log(
        `⚠️ No delivery boy within ${RADIUS_OPTIONS[RADIUS_OPTIONS.length - 1]}km ` +
        `(closest: ${closestDistance}km) — order ${orderId} remains Pending`
      );
      return {
        success: false,
        message: `No delivery boy within ${RADIUS_OPTIONS[RADIUS_OPTIONS.length - 1]}km. Closest is ${closestDistance}km away. Order kept as Pending.`,
        orderId,
      };
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 10: UPDATE ORDER WITH DELIVERY DETAILS
    // Status stays Pending — delivery boy must ACCEPT to confirm assignment
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    console.log(`\n💾 Updating order...`);

    const firstDeliveryBoy = nearbyDeliveryBoys[0];

    if (firstDeliveryBoy.agencyId) {
      order.agencyId = firstDeliveryBoy.agencyId._id;
      console.log(`🏢 Agency: ${firstDeliveryBoy.agencyId.agencyDetails.agencyName} (${firstDeliveryBoy.agencyId._id})`);
    } else {
      console.warn(`⚠️ Warning: ${firstDeliveryBoy.name} has no agencyId!`);
    }

    order.deliveryEarning  = firstDeliveryBoy.earning;
    order.deliveryDistance = firstDeliveryBoy.dropDistance;
    order.searchRadius     = usedRadius;

    // ✅ Store notified delivery boys — schema now has this field so it persists
    order.notifiedDeliveryBoys = nearbyDeliveryBoys.map((b) => b._id);

    console.log(`💰 Delivery earning: ${order.deliveryEarning} AED`);
    console.log(`📏 Delivery distance: ${order.deliveryDistance} km`);
    console.log(`🎯 Search radius used: ${usedRadius} km`);
    console.log(`📋 Status: Pending (awaiting delivery boy acceptance)`);
    console.log(`👥 Notified ${order.notifiedDeliveryBoys.length} delivery boys`);

    await order.save();

    console.log(`✅ Order updated successfully`);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 11: NOTIFY ALL NEARBY DELIVERY BOYS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    console.log(`\n🔔 Sending notifications...`);
    console.log('═'.repeat(70));

    const socketModule = require('../sockets/socket');
    const { getIO, isUserConnected } = socketModule;

    let successfulEmissions = 0;
    let failedEmissions     = 0;

    try {
      const io = getIO();

      const emissionData = {
        message: 'You have a new order to accept or reject',
        orderId: order._id.toString(),
        data: {
          nearbyDeliveryBoys,
          order: {
            ...order._doc,
            searchRadius: usedRadius,
          },
          shop: {
            id: shop._id,
            shopeDetails: {
              shopName:     shop.shopeDetails.shopName,
              shopAddress:  shop.shopeDetails.shopAddress  || '',
              shopContact:  shop.shopeDetails.shopContact  || '',
              shopLocation: shop.shopeDetails.shopLocation || '',
            },
            location: {
              latitude:  shopLatitude,
              longitude: shopLongitude,
            },
          },
          customer: {
            location: {
              latitude:  customerLat,
              longitude: customerLng,
            },
            address: order.deliveryAddress,
          },
        },
      };

      console.log(`📤 Notifying ${nearbyDeliveryBoys.length} delivery boys...`);

      for (let index = 0; index < nearbyDeliveryBoys.length; index++) {
        const boy           = nearbyDeliveryBoys[index];
        const deliveryBoyId = boy._id.toString();

        console.log(`\n  [${index + 1}/${nearbyDeliveryBoys.length}] ${boy.name || 'Unknown'}`);
        console.log(`     ID: ${deliveryBoyId}`);
        console.log(`     Distance: ${boy.pickupDistance} km (pickup), ${boy.dropDistance} km (drop)`);
        console.log(`     Earning: ${boy.earning} AED`);
        console.log(`     Est. Time: ${boy.totalTime}`);

        try {
          io.to(deliveryBoyId).emit('new_order_assigned', emissionData);

          const { sendPushOnly } = require('../helper/notificationHelper');
          sendPushOnly(
            deliveryBoyId,
            'New Order Available',
            `Pickup: ${boy.pickupDistance}km away. Earning: ${boy.earning} AED`,
            { route: 'order_assigned', order_id: order._id.toString() }
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
      message: `Notified ${nearbyDeliveryBoys.length} delivery boys within ${usedRadius} km (${shopEmirate} emirate). Awaiting acceptance.`,
      data: {
        nearbyDeliveryBoys,
        order,
        shop,
        successfulEmissions,
        failedEmissions,
        emirate:    shopEmirate,
        radiusUsed: usedRadius,
      },
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