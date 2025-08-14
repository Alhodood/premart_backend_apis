

/**
 * Auto-assign delivery boys within a radius and emit socket event
 * Reusable helper (no req/res) so it can be called from controllers or other services.
 *
 * Usage:
 *  const { autoAssignDeliveryBoy } = require('../helper/autoAssignHelper');
 *  await autoAssignDeliveryBoy(orderId, { maxDistanceKm: 5, avgSpeedKmph: 30, emitSockets: true });
 */

// Support both `module.exports = model` and `{ ModelName: model }` exports
function pickModel(mod, key) {
  return (mod && mod[key]) ? mod[key] : mod;
}
const Order = pickModel(require('../models/Order'), 'Order');
const Shop = pickModel(require('../models/Shop'), 'Shop');
const DeliveryBoy = pickModel(require('../models/DeliveryBoy'), 'DeliveryBoy');


let getIO;
try {
  // load lazily so tests can stub it and service can be used without sockets
  getIO = require('../sockets/socket').getIO;
} catch {
  getIO = null;
}

/**
 * Haversine formula to calculate distance between two coordinates (in km)
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Parse `lat,lng` string into numbers.
 */
function parseLatLng(str) {
  if (!str || typeof str !== 'string') return { lat: null, lng: null };
  const parts = str.split(',').map((s) => Number(String(s).trim()));
  const [lat, lng] = parts;
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : { lat: null, lng: null };
}

/**
 * Core assignment helper
 * @param {string} orderId - Mongo ObjectId string of the order
 * @param {object} options
 * @param {number} options.maxDistanceKm - max pickup distance (km)
 * @param {number} options.avgSpeedKmph - average assumed speed for ETA calc (km/h)
 * @param {boolean} options.emitSockets - whether to emit socket events
 * @returns {Promise<{nearbyDeliveryBoys: Array, order: any, shop: any}>}
 */
async function autoAssignDeliveryBoy(orderId, options = {}) {
  const {
    maxDistanceKm = 5,
    avgSpeedKmph = 30,
    emitSockets = true,
  } = options;

  if (!orderId) {
    throw new Error('orderId is required');
  }

  // 1) Find order
  const order = await Order.findById(orderId);
  if (!order) throw new Error('Order not found');

  // 2) Find shop and parse location
  const shop = await Shop.findById(order.shopId);
  const shopLocStr = shop?.shopeDetails?.shopLocation;
  if (!shop || !shopLocStr) throw new Error('Shop location not found');
  const { lat: shopLat, lng: shopLng } = parseLatLng(shopLocStr);
  if (!Number.isFinite(shopLat) || !Number.isFinite(shopLng)) {
    throw new Error('Invalid shop location coordinates');
  }

  // 3) Get customer coordinates
  const customerLat = order?.deliveryAddress?.latitude;
  const customerLng = order?.deliveryAddress?.longitude;
  if (!Number.isFinite(customerLat) || !Number.isFinite(customerLng)) {
    throw new Error('Invalid customer delivery coordinates on order');
  }

  // 4) Fetch available delivery boys
  const deliveryBoys = await DeliveryBoy.find({ availability: true });

  // 5) Compute distances and ETAs, filter within radius
  const nearbyDeliveryBoys = deliveryBoys
    .map((boy) => {
      const pickupDistance = calculateDistance(shopLat, shopLng, boy.latitude, boy.longitude);
      const dropDistance = calculateDistance(shopLat, shopLng, customerLat, customerLng);

      const pickupTimeMin = Math.ceil((pickupDistance / avgSpeedKmph) * 60);
      const dropTimeMin = Math.ceil((dropDistance / avgSpeedKmph) * 60);

      return {
        ...boy.toObject(),
        pickupDistance: Number(pickupDistance.toFixed(2)),
        dropDistance: Number(dropDistance.toFixed(2)),
        pickupTime: `${pickupTimeMin} mins`,
        dropTime: `${dropTimeMin} mins`,
      };
    })
    .filter((boy) => boy.pickupDistance <= maxDistanceKm)
    .sort((a, b) => a.pickupDistance - b.pickupDistance);

  if (nearbyDeliveryBoys.length === 0) {
    throw new Error(`No delivery boy found within ${maxDistanceKm} km`);
  }

  // 6) Update order status and push timeline
  order.orderStatus = 'Delivery Boy Assigned';
  await order.save();

  await Order.findByIdAndUpdate(order._id, {
    $push: {
      orderStatusList: { status: 'Order Confirmed', date: new Date() },
    },
  });

  // 7) Emit socket event to all nearby boys (if enabled and socket is available)
  if (emitSockets && typeof getIO === 'function') {
    try {
      const io = getIO();
      nearbyDeliveryBoys.forEach((boy) => {
        const room = String(boy._id);
        io.to(room).emit('new_order_assigned', {
          message: 'You have a new order to accept or reject',
          orderId: String(order._id),
          data: {
            nearbyDeliveryBoys,
            order,
            shop: {
              id: shop._id,
              name: shop.name,
              shopeDetails: shop.shopeDetails,
            },
          },
        });
      });
    } catch (err) {
      // Log but don't crash main flow
      console.warn('Socket emit failed in autoAssignDeliveryBoy:', err.message);
    }
  }

  return {
    nearbyDeliveryBoys,
    order,
    shop: {
      id: shop._id,
      name: shop.name,
      shopeDetails: shop.shopeDetails,
    },
  };
}

// Export canonical name and a legacy alias for backward compatibility
module.exports = {
  autoAssignDeliveryBoy,
  // Legacy alias to avoid "not a function" errors where the old name was used
  autoAssignDeliveryBoyWithin5kmHelper: autoAssignDeliveryBoy,
};