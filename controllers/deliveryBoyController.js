const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const DeliveryBoy = require('../models/DeliveryBoy');
const { DeliveryAgency } = require('../models/DeliveryAgency');
const Order = require('../models/Order');
const { Shop } = require('../models/Shop');
const axios = require('axios');
const { Product } = require('../models/_deprecated/Product');
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const geolib = require('geolib');
const Payment = require('../models/Payment');
const moment = require('moment');
const { getIO } = require('../sockets/socket');
const AgencyPayout = require('../models/AgencyPayout');
const ShopPayout = require('../models/ShopPayout');
const { getCommissionRates } = require('../helper/commissionHelper');
const SuperNotification = require('../models/superNotification');
const {
  notifyOrderStatusChange,
  notifyShopPayout,
  notifyAgencyPayment
} = require('./bellNotifications');

const logger = require('../config/logger'); // ← Winston logger

const twilio = require('twilio');
const SuperAdminSettings = require('../models/SuperAdminSettings');



exports.updateDeliveryBoy = async (req, res) => {
  try {
    const deliveryBoyId = req.params.deliveryBoyId;
    const updateData = { ...req.body };

    logger.info('🔄 Update Delivery Boy Request');
    logger.info(`📋 Delivery Boy ID: ${deliveryBoyId}`);
    logger.info(`📦 Update Data: ${JSON.stringify(updateData, null, 2)}`);

    if (!deliveryBoyId || !mongoose.Types.ObjectId.isValid(deliveryBoyId)) {
      return res.status(400).json({
        message: 'Invalid delivery boy ID',
        success: false,
        data: null
      });
    }

    const existingDeliveryBoy = await DeliveryBoy.findById(deliveryBoyId);
    if (!existingDeliveryBoy) {
      return res.status(404).json({
        message: 'Delivery Boy not found',
        success: false,
        data: null
      });
    }

    logger.info(`✅ Found existing delivery boy: ${existingDeliveryBoy.name}`);

    Object.keys(updateData).forEach(key => {
      const value = updateData[key];
      if (value === '' || value === null || value === undefined || value === 'null' || value === 'Null') {
        delete updateData[key];
      }
    });

    logger.info(`📝 Cleaned update data: ${JSON.stringify(updateData, null, 2)}`);

    if (updateData.profileImage !== undefined) {
      if (updateData.profileImage === null || 
          updateData.profileImage === 'null' || 
          updateData.profileImage === 'Null' ||
          updateData.profileImage === '') {
        updateData.profileImage = existingDeliveryBoy.profileImage || null;
      }
    }

    if (updateData.licenseImage !== undefined) {
      if (updateData.licenseImage === null || 
          updateData.licenseImage === 'null' || 
          updateData.licenseImage === 'Null' ||
          updateData.licenseImage === '') {
        updateData.licenseImage = existingDeliveryBoy.licenseImage || null;
      }
    }

    if (updateData.assignedOrders === undefined || updateData.assignedOrders === null) {
      updateData.assignedOrders = existingDeliveryBoy.assignedOrders || [];
    }

    if (updateData.email && updateData.email !== existingDeliveryBoy.email) {
      const emailExists = await DeliveryBoy.findOne({
        email: updateData.email,
        _id: { $ne: deliveryBoyId }
      });
      
      if (emailExists) {
        logger.warn(`❌ Email already exists: ${updateData.email}`);
        return res.status(409).json({
          message: `Email already exists: This email address (${updateData.email}) is already registered to another delivery agent.`,
          success: false,
          data: null,
          error: 'DUPLICATE_EMAIL',
          field: 'email',
          value: updateData.email
        });
      }
    }

    if (updateData.phone && updateData.phone !== existingDeliveryBoy.phone) {
      const phoneExists = await DeliveryBoy.findOne({
        phone: updateData.phone,
        _id: { $ne: deliveryBoyId }
      });
      
      if (phoneExists) {
        logger.warn(`❌ Phone already exists: ${updateData.phone}`);
        return res.status(409).json({
          message: `Phone already exists: This phone number (${updateData.phone}) is already registered to another delivery agent.`,
          success: false,
          data: null,
          error: 'DUPLICATE_PHONE',
          field: 'phone',
          value: updateData.phone
        });
      }
    }

    if (updateData.emiratesId && updateData.emiratesId !== existingDeliveryBoy.emiratesId) {
      const emiratesIdExists = await DeliveryBoy.findOne({
        emiratesId: updateData.emiratesId,
        _id: { $ne: deliveryBoyId }
      });
      
      if (emiratesIdExists) {
        logger.warn(`❌ Emirates ID already exists: ${updateData.emiratesId}`);
        return res.status(409).json({
          message: `Emirates ID already exists: This Emirates ID (${updateData.emiratesId}) is already registered to another delivery agent.`,
          success: false,
          data: null,
          error: 'DUPLICATE_EMIRATES_ID',
          field: 'emiratesId',
          value: updateData.emiratesId
        });
      }
    }

    logger.info(`📝 Final update data: ${JSON.stringify(updateData, null, 2)}`);

    const updatedDeliveryBoy = await DeliveryBoy.findByIdAndUpdate(
      deliveryBoyId,
      { $set: updateData },
      { 
        new: true,
        runValidators: false
      }
    ).populate('agencyId', 'agencyName agencyEmail agencyPhone');

    if (!updatedDeliveryBoy) {
      return res.status(404).json({
        message: 'Failed to update delivery boy',
        success: false,
        data: null
      });
    }

    logger.info(`✅ Delivery boy updated successfully: ${updatedDeliveryBoy._id}`);

    return res.status(200).json({
      message: 'Delivery Boy updated successfully',
      success: true,
      data: updatedDeliveryBoy
    });

  } catch (error) {
    logger.error('❌ Update Delivery Boy Error:', error);
    
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      const value = error.keyValue[field];
      
      let userMessage = '';
      let errorCode = 'DUPLICATE_KEY';
      
      if (field === 'email') {
        userMessage = `Email already exists: This email address (${value}) is already registered to another delivery agent.`;
        errorCode = 'DUPLICATE_EMAIL';
      } else if (field === 'phone') {
        userMessage = `Phone already exists: This phone number (${value}) is already registered to another delivery agent.`;
        errorCode = 'DUPLICATE_PHONE';
      } else if (field === 'emiratesId') {
        userMessage = `Emirates ID already exists: This Emirates ID (${value}) is already registered to another delivery agent.`;
        errorCode = 'DUPLICATE_EMIRATES_ID';
      } else {
        userMessage = `${field} already exists`;
      }
      
      logger.warn(`❌ Duplicate key error: ${JSON.stringify({ field, value, errorCode })}`);
      
      return res.status(409).json({
        message: userMessage,
        success: false,
        data: null,
        error: errorCode,
        field: field,
        value: value
      });
    }

    res.status(500).json({
      message: 'Failed to update delivery boy',
      success: false,
      error: error.message
    });
  }
};

exports.getAllDeliveryBoys = async (req, res) => {
  try {
    const deliveryBoys = await DeliveryBoy.find({}, {
      name: 1,
      email: 1,
      phone: 1,
      countryCode: 1,
      dob: 1,
      licenseNo: 1,
      accountVerify: 1,
      isOnline: 1,
      assignedOrders: 1,
      profileImage: 1,
      licenseImage: 1,
      role: 1,
      areaAssigned: 1,
      emiratesId: 1,
      operatingHours: 1,
      agencyAddress: 1,
      city: 1,
      latitude: 1,
      longitude: 1,
      availability: 1,
      agencyId: 1,
      createdAt: 1,
      updatedAt: 1,
    })
    .populate({
      path: 'agencyId',
      select: 'agencyDetails.agencyName agencyDetails.agencyContact agencyDetails.agencyAddress'
    })
    .lean();

    const formatted = deliveryBoys.map(boy => ({
      _id: boy._id,
      name: boy.name || null,
      email: boy.email || null,
      agencyName: boy.agencyId?.agencyDetails?.agencyName || null,
      phone: boy.phone || null,
      DOB: boy.dob || null,
      licenseNo: boy.licenseNo || null,
      status: boy.isOnline ? 'Online' : 'Offline',
      profileImage: boy.profileImage || null,
      licenseImage: boy.licenseImage || null,
      role: boy.role || "DELIVERY_BOY",
      areaAssigned: boy.areaAssigned || null,
      emiratesId: boy.emiratesId || null,
      operatingHours: boy.operatingHours || null,
      agencyAddress: boy.agencyAddress || null,
      city: boy.city || null,
      latitude: boy.latitude ?? 0,
      longitude: boy.longitude ?? 0,
      agencyId: boy.agencyId?._id || null,
      agencyContact: boy.agencyId?.agencyDetails?.agencyContact || null,
      agencyFullAddress: boy.agencyId?.agencyDetails?.agencyAddress || null,
      createdAt: boy.createdAt || null,
      updatedAt: boy.updatedAt || null,
    }));

    res.status(200).json({
      message: "Delivery boys fetched successfully",
      success: true,
      total: formatted.length,
      data: formatted
    });
  } catch (err) {
    logger.error('❌ Error fetching delivery boys:', err);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch delivery boys",
      error: err.message 
    });
  }
};

exports.deleteDeliveryBoy = async (req, res) => {
  try {
    const deliveryBoyId = req.params.deliveryBoyId;

    const deleted = await DeliveryBoy.findByIdAndDelete(deliveryBoyId);

    if (!deleted) {
      return res.status(404).json({
        message: 'Delivery Boy not found',
        success: false,
        data: []
      });
    }

    return res.status(200).json({
      message: 'Delivery Boy deleted successfully',
      success: true,
      data: []
    });

  } catch (error) {
    logger.error('Delete Delivery Boy Error:', error);
    res.status(500).json({
      message: 'Failed to delete delivery boy',
      success: false,
      data: error.message
    });
  }
};

exports.getDeliveryBoyById = async (req, res) => {
  try {
    const { deliveryBoyId } = req.params;

    logger.info('🔍 Get Delivery Boy Request');
    logger.info(`📋 Delivery Boy ID: ${deliveryBoyId}`);

    if (!deliveryBoyId || !mongoose.Types.ObjectId.isValid(deliveryBoyId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid delivery boy ID",
        data: null,
      });
    }

    const deliveryBoy = await DeliveryBoy.findById(deliveryBoyId)
      .populate('agencyId', 'agencyName agencyEmail agencyPhone agencyAddress')
      .populate({
        path: 'assignedOrders',
        select: 'orderNumber status totalAmount createdAt',
        options: { limit: 10, sort: { createdAt: -1 } }
      });

    if (!deliveryBoy) {
      return res.status(404).json({
        success: false,
        message: "Delivery boy not found",
        data: null,
      });
    }

    logger.info(`✅ Delivery boy found: ${deliveryBoy.name}`);

    res.status(200).json({
      success: true,
      message: "Delivery boy fetched successfully",
      data: deliveryBoy,
    });

  } catch (error) {
    logger.error('❌ Get delivery boy error:', error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

exports.updateLiveLocation = async (req, res) => {
  try {
    const deliveryBoyId = req.params.deliveryBoyId;
    const { latitude, longitude } = req.body;

    if (!deliveryBoyId || latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        message: 'DeliveryBoyId, Latitude and Longitude are required',
        success: false,
        data: []
      });
    }

    const updatedDeliveryBoy = await DeliveryBoy.findByIdAndUpdate(
      deliveryBoyId,
      { latitude, longitude },
      { new: true }
    );

    if (!updatedDeliveryBoy) {
      return res.status(404).json({
        message: 'Delivery Boy not found',
        success: false,
        data: []
      });
    }

    return res.status(200).json({
      message: 'Live location updated successfully',
      success: true,
      data: updatedDeliveryBoy
    });

  } catch (error) {
    logger.error('Update Live Location Error:', error);
    res.status(500).json({
      message: 'Failed to update live location',
      success: false,
      data: error.message
    });
  }
};

exports.viewAssignedOrders = async (req, res) => {
  try {
    const deliveryBoyId = req.params.deliveryBoyId;

    const deliveryBoy = await DeliveryBoy.findById(deliveryBoyId);
    if (!deliveryBoy) {
      return res.status(404).json({
        message: 'Delivery Boy not found',
        success: false,
        data: []
      });
    }

    if (!deliveryBoy.isOnline) {
      return res.status(200).json({
        message: 'You are offline. No assigned orders shown.',
        success: true,
        data: []
      });
    }

    const allowedStatuses = [
      "Delivery Boy Assigned",  
      "Accepted by Delivery Boy",
      "Order Accepted By Delivery Boy",
      "Reached Pickup",
      "Waiting to Pick",
      "Order Picked",
      "Reached Drop",
    ];

    const assignedOrders = await Order.find({
      assignedDeliveryBoy: new mongoose.Types.ObjectId(deliveryBoyId),
      status: { $in: allowedStatuses }
    }).sort({ createdAt: -1 });

    logger.info(`📦 Found assigned orders: ${assignedOrders.length}`);

    const results = [];

    for (const order of assignedOrders) {
      const shop = await Shop.findById(order.shopId);
      const shopLocation = shop?.shopeDetails?.shopLocation;
      const [shopLat, shopLng] = shopLocation?.split(',').map(Number) || [];

      const { latitude: boyLat, longitude: boyLng } = deliveryBoy;
      const { latitude: customerLat, longitude: customerLng } = order.deliveryAddress;

      const pickupDistanceKm = geolib.getDistance(
        { latitude: boyLat, longitude: boyLng },
        { latitude: shopLat, longitude: shopLng }
      ) / 1000;

      const dropDistanceKm = geolib.getDistance(
        { latitude: shopLat, longitude: shopLng },
        { latitude: customerLat, longitude: customerLng }
      ) / 1000;

      let pickupTime = "N/A";
      let dropTime = "N/A";

      if (boyLat && boyLng && shopLat && shopLng && customerLat && customerLng) {
        try {
          const pickupUrl = encodeURI(
            `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${boyLat},${boyLng}&destinations=${shopLat},${shopLng}&key=${GOOGLE_MAPS_API_KEY}`
          );
          const pickupResponse = await axios.get(pickupUrl);
          const pickupElement = pickupResponse.data?.rows?.[0]?.elements?.[0];
          pickupTime = pickupElement?.status === 'OK' && pickupElement?.duration
            ? pickupElement.duration.text
            : 'N/A';

          const dropUrl = encodeURI(
            `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${shopLat},${shopLng}&destinations=${customerLat},${customerLng}&key=${GOOGLE_MAPS_API_KEY}`
          );
          const dropResponse = await axios.get(dropUrl);
          const dropElement = dropResponse.data?.rows?.[0]?.elements?.[0];
          dropTime = dropElement?.status === 'OK' && dropElement?.duration
            ? dropElement.duration.text
            : 'N/A';
        } catch (err) {
          logger.error(`❌ Google Maps API Error: ${err?.response?.data || err.message}`);
        }
      }

      const parseTimeToMinutes = (str) => {
        if (!str || str === 'N/A') return 0;
        const matches = str.match(/(\d+)\s*hour[s]?|(\d+)\s*min[s]?/g) || [];
        let total = 0;
        matches.forEach(part => {
          if (part.includes('hour')) total += parseInt(part) * 60;
          else if (part.includes('min')) total += parseInt(part);
        });
        return total;
      };

      const pickupMinutes = parseTimeToMinutes(pickupTime);
      const dropMinutes = parseTimeToMinutes(dropTime);
      const totalEstimatedTime = `${pickupMinutes + dropMinutes} mins`;

      const payment = await Payment.findOne({ orderId: order._id });
      const paymentInfo = {
        method: payment?.paymentMethod || 'Unknown',
        status: payment?.paymentStatus || 'Unpaid'
      };

      results.push({
        orderId: order._id,
        ...order._doc,
        _id: undefined,
        shopDetails: shop,
        pickupTime,
        dropTime,
        deliveryEarning: order.deliveryEarning,
        pickupDistance: `${pickupDistanceKm.toFixed(2)} km`,
        dropDistance: `${dropDistanceKm.toFixed(2)} km`,
        totalEstimatedTime,
        payment: paymentInfo
      });
    }

    return res.status(200).json({
      message: 'Assigned orders fetched successfully',
      success: true,
      data: results
    });

  } catch (error) {
    logger.error('View Assigned Orders Error:', error);
    return res.status(500).json({
      message: 'Failed to fetch assigned orders',
      success: false,
      data: error.message
    });
  }
};

exports.getNearbyAssignedOrders = async (req, res) => {
  try {
    const deliveryBoyId = req.params.deliveryBoyId;

    const { DeliveryAgency } = require('../models/DeliveryAgency');

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

    let agencyEmirates = [];
    if (deliveryBoy.agencyId) {
      const agency = await DeliveryAgency.findById(deliveryBoy.agencyId)
        .select('agencyDetails.emirates')
        .lean();
      agencyEmirates = agency?.agencyDetails?.emirates || [];
      logger.info(
        `🏢 Agency emirates filter: ${agencyEmirates.length > 0 ? agencyEmirates.join(', ') : 'none (no restriction)'}`
      );
    }

    const activeStatuses = [
      'Pending',
      'Delivery Boy Assigned',
      'Accepted by Delivery Boy',
      'Reached Pickup',
      'Waiting to Pick',
      'Order Picked',
      'On the way',
      'Reached Drop'
    ];

    const assignedOrders = await Order.find({
      status: { $in: activeStatuses }
    });

    logger.info(`📦 Found ${assignedOrders.length} orders (including Pending)`);

    const formattedNearbyOrders = [];

    const mongoose = require('mongoose');
    const Shop = mongoose.model('Shop');
    const geolib = require('geolib');

    const { getEmirateFromCoordinates } = require('../helper/autoAssignHelper');

    for (const order of assignedOrders) {
      try {
        const shop = await Shop.findById(order.shopId);

        if (!shop?.shopeDetails?.shopLocation) {
          logger.warn(`⚠️ Skipping order ${order._id} - no shop location`);
          continue;
        }

        const shopLocation = shop.shopeDetails.shopLocation;
        const coords = shopLocation.split(',').map(str => parseFloat(str.trim()));

        if (coords.length !== 2 || isNaN(coords[0]) || isNaN(coords[1])) {
          logger.warn(`⚠️ Skipping order ${order._id} - invalid shop coordinates`);
          continue;
        }

        const [shopLat, shopLng] = coords;

        if (agencyEmirates.length > 0) {
          const shopEmirate =
            shop.shopeDetails?.emirates ||
            getEmirateFromCoordinates(shopLat, shopLng);

          const coversEmirate = agencyEmirates.some(
            e => e.toLowerCase() === shopEmirate.toLowerCase()
          );

          if (!coversEmirate) {
            logger.info(
              `🚫 Skipping order ${order._id} - shop in ${shopEmirate}, agency covers [${agencyEmirates.join(', ')}]`
            );
            continue;
          }
        }

        const pickupDistance =
          geolib.getDistance(
            { latitude: boyLat, longitude: boyLng },
            { latitude: shopLat, longitude: shopLng }
          ) / 1000;

        if (pickupDistance > RANGE_KM) {
          logger.info(`⚠️ Skipping order ${order._id} - too far (${pickupDistance.toFixed(2)} km)`);
          continue;
        }

        const pickupTime = `${Math.ceil((pickupDistance / 30) * 60)} mins`;

        let dropDistance = 0;
        let dropTime = 'N/A';
        const customerLat = order?.deliveryAddress?.latitude;
        const customerLng = order?.deliveryAddress?.longitude;

        if (shopLat && shopLng && customerLat && customerLng) {
          dropDistance =
            geolib.getDistance(
              { latitude: shopLat, longitude: shopLng },
              { latitude: customerLat, longitude: customerLng }
            ) / 1000;
          dropTime = `${Math.ceil((dropDistance / 30) * 60)} mins`;
        }

        const shopDetails = {
          shopName:     shop?.shopeDetails?.shopName     || '',
          shopAddress:  shop?.shopeDetails?.shopAddress  || '',
          shopContact:  shop?.shopeDetails?.shopContact  || '',
          shopLocation: shop?.shopeDetails?.shopLocation || '',
        };

        const deliveryDetails = {
          deliveryBoyId:    order.assignedDeliveryBoy || null,
          orderStatus:      order.status,
          pickupDistance:   pickupDistance.toFixed(2),
          pickupTime,
          dropDistance:     dropDistance.toFixed(2),
          dropTime,
          deliveryEarnings: order.deliveryEarning || 0,
        };

        const deliveryAddress = {
          name:      order?.deliveryAddress?.name      || 'N/A',
          address:   order?.deliveryAddress?.address   || 'N/A',
          contact:   order?.deliveryAddress?.contact   || 'N/A',
          area:      order?.deliveryAddress?.area      || 'N/A',
          place:     order?.deliveryAddress?.place     || 'N/A',
          latitude:  order?.deliveryAddress?.latitude  || null,
          longitude: order?.deliveryAddress?.longitude || null,
        };

        formattedNearbyOrders.push({
          orderId: order._id,
          shopDetails,
          deliveryDetails,
          deliveryAddress,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
        });

        logger.info(`✅ Added order ${order._id} (${order.status}) - ${pickupDistance.toFixed(2)} km away`);
      } catch (orderError) {
        logger.error(`❌ Error processing order ${order._id}: ${orderError.message}`);
        continue;
      }
    }

    logger.info(`📊 Returning ${formattedNearbyOrders.length} nearby orders`);

    return res.status(200).json({
      message: 'Nearby orders fetched successfully',
      success: true,
      data: formattedNearbyOrders,
    });
  } catch (error) {
    logger.error('Get Nearby Assigned Orders Error:', error);
    return res.status(500).json({
      message: 'Failed to fetch nearby orders',
      success: false,
      data: error.message,
    });
  }
};

exports.getOngoingOrdersForDeliveryBoy = async (req, res) => {
  try {
    const { deliveryBoyId } = req.params;

    if (!deliveryBoyId) {
      return res.status(400).json({
        success: false,
        message: 'Delivery Boy ID is required'
      });
    }

    logger.info(`🔍 Fetching ongoing orders for delivery boy: ${deliveryBoyId}`);

    const ongoingOrders = await Order.find({
      assignedDeliveryBoy: deliveryBoyId,
      status: { $nin: ['Delivered', 'Cancelled'] }
    }).sort({ updatedAt: -1 });

    logger.info(`📦 Found ${ongoingOrders.length} ongoing orders`);

    const ordersWithDetails = await Promise.all(
      ongoingOrders.map(async (order) => {
        const shop = await Shop.findById(order.shopId);
        
        const deliveryBoy = await DeliveryBoy.findById(deliveryBoyId);
        
        let pickupDistance = 'N/A';
        let pickupTime = 'N/A';
        let dropDistance = 'N/A';
        let dropTime = 'N/A';

        if (shop && shop.shopeDetails && shop.shopeDetails.shopLocation && deliveryBoy) {
          const [shopLat, shopLng] = shop.shopeDetails.shopLocation.split(',').map(Number);
          const boyLat = deliveryBoy.latitude;
          const boyLng = deliveryBoy.longitude;

          if (!isNaN(shopLat) && !isNaN(shopLng) && boyLat && boyLng) {
            const pickupDist = geolib.getDistance(
              { latitude: boyLat, longitude: boyLng },
              { latitude: shopLat, longitude: shopLng }
            ) / 1000;

            pickupDistance = `${pickupDist.toFixed(2)} km`;
            pickupTime = `${Math.ceil((pickupDist / 30) * 60)} mins`;

            const customerLat = order.deliveryAddress?.latitude;
            const customerLng = order.deliveryAddress?.longitude;

            if (customerLat && customerLng) {
              const dropDist = geolib.getDistance(
                { latitude: shopLat, longitude: shopLng },
                { latitude: customerLat, longitude: customerLng }
              ) / 1000;

              dropDistance = `${dropDist.toFixed(2)} km`;
              dropTime = `${Math.ceil((dropDist / 30) * 60)} mins`;
            }
          }
        }

        return {
          ...order._doc,
          shopDetails: shop ? {
            shopeDetails: {
              shopName: shop.shopeDetails?.shopName || 'Unknown Shop',
              shopAddress: shop.shopeDetails?.shopAddress || '',
              shopContact: shop.shopeDetails?.shopContact || '',
              shopLocation: shop.shopeDetails?.shopLocation || '',
            }
          } : null,
          pickupDistance,
          pickupTime,
          dropDistance,
          dropTime
        };
      })
    );

    return res.status(200).json({
      success: true,
      message: 'Ongoing orders fetched successfully',
      data: ordersWithDetails
    });
  } catch (err) {
    logger.error('❌ Get Ongoing Orders Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching ongoing orders',
      error: err.message
    });
  }
};

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (v) => v * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

exports.deliveryBoyAcceptOrReject = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const { action, deliveryBoyId } = req.body;

    logger.info(`📦 Delivery boy ${deliveryBoyId} attempting to ${action} order ${orderId}`);

    if (!orderId || !action || !deliveryBoyId) {
      return res.status(400).json({
        message: 'OrderId, action and deliveryBoyId are required',
        success: false,
        data: []
      });
    }

    const deliveryBoy = await DeliveryBoy.findById(deliveryBoyId);
    if (!deliveryBoy) {
      return res.status(404).json({
        message: 'Delivery Boy not found',
        success: false,
        data: []
      });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        message: 'Order not found',
        success: false,
        data: []
      });
    }

    if (action === "accept") {
      if (order.assignedDeliveryBoy && 
          order.assignedDeliveryBoy.toString() !== deliveryBoyId.toString()) {
        return res.status(409).json({
          message: 'Order already accepted by another delivery boy',
          success: false,
          data: {
            assignedTo: order.assignedDeliveryBoy,
            alreadyTaken: true
          }
        });
      }

      order.status = "Accepted by Delivery Boy";
      order.assignedDeliveryBoy = deliveryBoyId;

      if (deliveryBoy.agencyId) {
        order.agencyId = deliveryBoy.agencyId;
        logger.info(`🏢 Agency ID set to: ${deliveryBoy.agencyId}`);
      }
      
      if (!Array.isArray(order.statusHistory)) {
        order.statusHistory = [];
      }
      order.statusHistory.push({ 
        status: 'Accepted by Delivery Boy', 
        date: new Date() 
      });
      
      await order.save();

      if (!Array.isArray(deliveryBoy.assignedOrders)) {
        deliveryBoy.assignedOrders = [];
      }

      const orderIdStr = orderId.toString();
      const alreadyAssigned = deliveryBoy.assignedOrders.some(
        id => id.toString() === orderIdStr
      );

      if (!alreadyAssigned) {
        deliveryBoy.assignedOrders.push(orderId);
        await deliveryBoy.save();
      }

      logger.info(`✅ Order ${orderId} accepted by delivery boy ${deliveryBoyId}`);
      logger.info(`💰 Order earning: ${order.deliveryEarning} AED`);
      logger.info(`📍 Delivery distance: ${order.deliveryDistance} km`);

      try {
        const io = require('../sockets/socket').getIO();
        
        io.emit('order_accepted', {
          orderId: order._id,
          deliveryBoyId: deliveryBoy._id,
          deliveryBoyName: deliveryBoy.name,
          shopId: order.shopId,
          status: order.status
        });

        io.to(deliveryBoyId.toString()).emit('order_accepted_confirmation', {
          orderId: order._id,
          message: 'Order accepted successfully',
          deliveryEarning: order.deliveryEarning
        });

        io.emit('order_taken_by_another', {
          orderId: order._id.toString(),
          takenBy: deliveryBoyId.toString(),
          message: 'This order has been accepted by another delivery boy'
        });

        logger.info(`📢 Broadcasted order_taken_by_another for order ${orderId}`);

      } catch (socketErr) {
        logger.warn(`Socket.IO emit failed: ${socketErr.message}`);
      }

      return res.status(200).json({
        message: 'Order accepted successfully',
        success: true,
        data: {
          orderId: order._id,
          status: order.status,
          deliveryDistance: order.deliveryDistance,
          deliveryEarning: order.deliveryEarning,
          totalPayable: order.totalPayable,
          deliveryAddress: order.deliveryAddress,
          assignedDeliveryBoy: {
            _id: deliveryBoy._id,
            name: deliveryBoy.name,
            phone: deliveryBoy.phone
          }
        }
      });

    } else if (action === "reject") {
      order.assignedDeliveryBoy = null;
      order.status = "Pending for Delivery Assignment";
      
      if (!Array.isArray(order.statusHistory)) {
        order.statusHistory = [];
      }
      order.statusHistory.push({
        status: 'Rejected by Delivery Boy',
        date: new Date(),
        rejectedBy: deliveryBoyId
      });
      
      await order.save();

      if (Array.isArray(deliveryBoy.assignedOrders) && deliveryBoy.assignedOrders.length > 0) {
        const orderIdStr = orderId.toString();
        deliveryBoy.assignedOrders = deliveryBoy.assignedOrders.filter(
          id => id.toString() !== orderIdStr
        );
        await deliveryBoy.save();
      }

      logger.info(`❌ Order ${orderId} rejected by delivery boy ${deliveryBoyId}`);

      try {
        const io = require('../sockets/socket').getIO();
        
        io.emit('order_rejected', {
          orderId: order._id,
          deliveryBoyId: deliveryBoy._id,
          shopId: order.shopId,
          status: order.status
        });

      } catch (socketErr) {
        logger.warn(`Socket.IO emit failed: ${socketErr.message}`);
      }

      return res.status(200).json({
        message: 'Order rejected successfully',
        success: true,
        data: {
          orderId: order._id,
          status: order.status,
          note: 'Order is now available for other delivery boys'
        }
      });

    } else {
      return res.status(400).json({
        message: 'Invalid action, must be accept or reject',
        success: false,
        data: []
      });
    }

  } catch (error) {
    logger.error('❌ DeliveryBoy Accept/Reject Error:', error);
    res.status(500).json({
      message: 'Failed to process delivery boy action',
      success: false,
      data: error.message
    });
  }
};

exports.deliveryBoyUpdateOrderStatus = async (req, res) => {
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

    const updatedOrder = await Order.findById(orderId);
    if (!updatedOrder) {
      return res.status(404).json({
        message: 'Order not found',
        success: false,
        data: []
      });
    }

    updatedOrder.status = newStatus;
    if (!updatedOrder.statusHistory) {
      updatedOrder.statusHistory = [];
    }
    updatedOrder.statusHistory.push({
      status: newStatus,
      date: new Date()
    });

    const currentMonth = new Date().toLocaleString('default', {
      month: 'long',
      year: 'numeric'
    });

    if (updatedOrder.status === 'Delivered') {
      logger.info('📦 Order delivered, processing payments...');

      updatedOrder.deliveredAt = new Date();
      logger.info(`📅 Delivered at: ${updatedOrder.deliveredAt}`);

      updatedOrder.paymentStatus = 'Paid';
      logger.info('💳 Payment status updated to: Paid');

      const { shopCommission, agencyCommission } = await getCommissionRates();
      logger.info(`💼 Commission Rates — Shop: ${shopCommission}%, Agency: ${agencyCommission}%`);

      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const endOfMonth   = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);

      const orderEarning           = Number(updatedOrder.deliveryEarning || 0);
      const agencyCommissionAmount = (orderEarning * agencyCommission) / 100;
      const netAgencyEarning       = orderEarning - agencyCommissionAmount;

      logger.info(`💰 Agency — Gross: ${orderEarning} AED | Commission: ${agencyCommissionAmount} AED (${agencyCommission}%) | Net: ${netAgencyEarning} AED`);

      const deliveryBoy = await DeliveryBoy.findById(updatedOrder.assignedDeliveryBoy).lean();

      let agencyPayout = null;

      if (deliveryBoy && deliveryBoy.agencyId) {
        agencyPayout = await AgencyPayout.findOne({
          agencyId: deliveryBoy.agencyId,
          from: startOfMonth,
          to: endOfMonth,
          status: 'Pending'
        });

        if (agencyPayout) {
          agencyPayout.totalOrders   += 1;
          agencyPayout.totalEarnings += netAgencyEarning;
          agencyPayout.deliveryBoyId  = deliveryBoy._id;
          agencyPayout.orderId        = updatedOrder._id;
          await agencyPayout.save();
          logger.info(`✅ Updated PENDING agency payout: ${agencyPayout.totalEarnings} AED`);
        } else {
          agencyPayout = await AgencyPayout.create({
            agencyId:      deliveryBoy.agencyId,
            deliveryBoyId: deliveryBoy._id,
            orderId:       updatedOrder._id,
            totalOrders:   1,
            totalEarnings: netAgencyEarning,
            from:          startOfMonth,
            to:            endOfMonth,
            month:         currentMonth,
            status:        'Pending',
            transactionId: null
          });
          logger.info(`✅ Created NEW PENDING agency payout: ${netAgencyEarning} AED`);
        }
      }

      const shopId      = updatedOrder.shopId;
      const orderAmount = Number(updatedOrder.totalPayable || 0);
      const commission  = (orderAmount * shopCommission) / 100;
      const netPayable  = orderAmount - commission;

      logger.info(`🏪 Shop — Total: ${orderAmount} AED | Commission: ${commission} AED (${shopCommission}%) | Net: ${netPayable} AED`);

      let shopPayout = await ShopPayout.findOne({
        shopId,
        from: startOfMonth,
        to: endOfMonth,
        status: 'Pending'
      });

      if (shopPayout) {
        shopPayout.totalOrders        += 1;
        shopPayout.totalSales         += orderAmount;
        shopPayout.platformCommission += commission;
        shopPayout.netPayable         += netPayable;
        await shopPayout.save();
        logger.info('✅ Updated PENDING shop payout');
      } else {
        shopPayout = await ShopPayout.create({
          shopId,
          totalOrders:        1,
          totalSales:         orderAmount,
          platformCommission: commission,
          netPayable,
          from:               startOfMonth,
          to:                 endOfMonth,
          status:             'Pending',
          transactionId:      null
        });
        logger.info(`✅ Created NEW PENDING shop payout: ${netPayable} AED`);
      }
    }

    await updatedOrder.save();

    try {
      const shop = await Shop.findById(updatedOrder.shopId);

      await notifyOrderStatusChange(updatedOrder, newStatus, shop);

      const io = getIO();
      io.emit('order_status_changed', {
        orderId:       updatedOrder._id,
        status:        updatedOrder.status,
        paymentStatus: updatedOrder.paymentStatus,
        shopId:        updatedOrder.shopId,
        deliveryBoyId: updatedOrder.assignedDeliveryBoy,
        updatedAt:     updatedOrder.updatedAt,
      });

      logger.info(`✅ Socket emitted: order_status_changed → ${newStatus}`);
    } catch (err) {
      logger.warn(`⚠️ Notification/Socket error: ${err.message}`);
    }

    return res.status(200).json({
      message: 'Order status updated successfully',
      success: true,
      data: updatedOrder
    });

  } catch (error) {
    logger.error('❌ DeliveryBoy Update Status Error:', error);
    return res.status(500).json({
      message: 'Failed to update order status',
      success: false,
      data: error.message
    });
  }
};

exports.deliveryBoyRaiseIssue = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const { issueDescription } = req.body;

    if (!orderId || !issueDescription) {
      return res.status(400).json({
        message: 'OrderId and Issue Description are required',
        success: false,
        data: []
      });
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      { 
        deliveryIssue: issueDescription, 
        orderStatus: "Delivery Issue Reported" 
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
      message: 'Issue reported successfully',
      success: true,
      data: updatedOrder
    });

  } catch (error) {
    logger.error('Raise Delivery Issue Error:', error);
    res.status(500).json({
      message: 'Failed to report delivery issue',
      success: false,
      data: error.message
    });
  }
};

exports.getDeliveryBoysByAgency = async (req, res) => {
  try {
    const { agencyId } = req.params;
    if (!agencyId) {
      return res.status(400).json({
        message: 'Agency ID is required',
        success: false,
        data: [],
      });
    }

    const deliveryBoys = await DeliveryBoy.find({ agencyId })
      .select('-password -countryCode -__v -availability -accountVerify -assignedOrders')
      .lean();

    const formatted = deliveryBoys.map(({ dob, isOnline, ...rest }) => ({
      ...rest,
      DOB: dob || null,
      status: isOnline ? 'Online' : 'Offline',
    }));

    return res.status(200).json({
      message: 'Delivery boys fetched successfully',
      success: true,
      count: formatted.length,
      data: formatted
    });
  } catch (error) {
    logger.error('Get Delivery Boys Error:', error);
    return res.status(500).json({
      message: 'Failed to fetch delivery boys',
      success: false,
      data: error.message,
    });
  }
};

exports.getLiveLocationsByAgency = async (req, res) => {
  try {
    const { agencyId } = req.params;

    if (!agencyId) {
      return res.status(400).json({ message: 'Agency ID is required', success: false });
    }

    const deliveryBoys = await DeliveryBoy.find({ agencyId }, {
      name: 1,
      phone: 1,
      latitude: 1,
      longitude: 1,
      availability: 1
    });

    return res.status(200).json({
      message: 'Live locations fetched',
      success: true,
      data: deliveryBoys
    });

  } catch (error) {
    res.status(500).json({
      message: 'Failed to fetch live locations',
      success: false,
      data: error.message
    });
  }
};

exports.getAllDeliveryBoysForMap = async (req, res) => {
  try {
    const deliveryBoys = await DeliveryBoy.find({}, {
      name: 1,
      phone: 1,
      latitude: 1,
      longitude: 1,
      availability: 1
    });

    res.status(200).json({
      message: 'All delivery boys for map',
      success: true,
      data: deliveryBoys
    });

  } catch (error) {
    res.status(500).json({
      message: 'Failed to fetch delivery boys',
      success: false,
      data: error.message
    });
  }
};

exports.getNearbyOnlineDeliveryBoys = async (req, res) => {
  try {
    const { shopId } = req.params;
    const range = parseFloat(req.query.range || 5);

    const shop = await Shop.findById(shopId);
    if (!shop || !shop.shopeDetails?.shopLocation) {
      return res.status(404).json({ success: false, message: 'Shop location not found' });
    }

    const [lat1, lon1] = shop.shopeDetails.shopLocation.split(',').map(Number);

    const deliveryBoys = await DeliveryBoy.find({ availability: true });

    const toRad = (x) => (x * Math.PI) / 180;
    const calcDistance = (lat2, lon2) => {
      const R = 6371;
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a = Math.sin(dLat / 2) ** 2 +
                Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
                Math.sin(dLon / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    const nearby = deliveryBoys.map(boy => {
      const dist = calcDistance(boy.latitude, boy.longitude);
      return {
        ...boy.toObject(),
        distanceFromShopKm: parseFloat(dist.toFixed(2))
      };
    }).filter(boy => boy.distanceFromShopKm <= range);

    return res.status(200).json({
      message: 'Nearby online delivery boys',
      success: true,
      data: nearby
    });

  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch delivery boys', success: false, data: err.message });
  }
};

exports.toggleAvailability = async (req, res) => {
  try {
    const { deliveryBoyId } = req.params;

    const deliveryBoy = await DeliveryBoy.findOne({
      _id: deliveryBoyId,
      role: 'DELIVERY_BOY'
    });

    if (!deliveryBoy) {
      return res.status(404).json({
        success: false,
        message: "Delivery Boy not found"
      });
    }

    const newStatus = !deliveryBoy.isOnline;

    deliveryBoy.isOnline = newStatus;
    deliveryBoy.availability = newStatus;

    await deliveryBoy.save();

    try {
      const io = require('../sockets/socket').getIO();
      io.emit('deliveryBoyStatusChanged', {
        deliveryBoyId: deliveryBoy._id,
        isOnline: newStatus
      });
    } catch (e) {}

    res.status(200).json({
      success: true,
      message: `Status updated to ${newStatus ? 'Online' : 'Offline'}`,
      isOnline: newStatus
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to toggle availability",
      error: err.message
    });
  }
};

const getDistanceInKm = (lat1, lon1, lat2, lon2) => {
  logger.info(`Calculating distance between (${lat1}, ${lon1}) and (${lat2}, ${lon2})`);
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

exports.getNearbyTopOrderAreas = async (req, res) => {
  try {
    const orders = await Order.find({
      status: "Delivered",
      "deliveryAddress.latitude": { $exists: true, $ne: null },
      "deliveryAddress.longitude": { $exists: true, $ne: null }
    });

    const locationMap = {};
    orders.forEach(order => {
      const addr = order.deliveryAddress || {};
      const key = `${addr.area || ""}|${addr.place || ""}`;
      if (!locationMap[key]) {
        locationMap[key] = {
          area: addr.area || "",
          place: addr.place || "",
          latitude: addr.latitude,
          longitude: addr.longitude,
          name: addr.name || "",
          contact: addr.contact || "",
          address: addr.address || "",
          addressType: addr.addressType || "Home",
          default: addr.default ?? true,
          totalOrders: 1
        };
      } else {
        locationMap[key].totalOrders += 1;
      }
    });

    const ranked = Object.values(locationMap)
      .sort((a, b) => b.totalOrders - a.totalOrders)
      .slice(0, 6)
      .map((loc) => ({
        deliveryAddress: {
          name: loc.name,
          contact: loc.contact,
          address: loc.address,
          area: loc.area,
          place: loc.place,
          default: loc.default,
          addressType: loc.addressType,
          latitude: loc.latitude,
          longitude: loc.longitude
        }
      }));

    return res.status(200).json({
      success: true,
      message: "Nearby top order areas fetched successfully.",
      data: ranked
    });
  } catch (error) {
    logger.error('Nearby Top Areas Error:', error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch nearby top order areas",
      error: error.message
    });
  }
};

exports.getDeliveryEarningsHistory = async (req, res) => {
  try {
    const deliveryBoyId = req.params.deliveryBoyId;

    const deliveredOrders = await Order.find({
      assignedDeliveryBoy: deliveryBoyId,
      status: 'Delivered'
    }).sort({ updatedAt: -1 });

    const totalEarnings = deliveredOrders.reduce(
      (sum, order) => sum + (order.deliveryEarning || 0),
      0
    );

    const todayStart = moment().startOf('day');
    const todayEnd = moment().endOf('day');
    const weekStart = moment().startOf('week');
    const monthStart = moment().startOf('month');

    const todayOrders = deliveredOrders.filter(order =>
      moment(order.updatedAt).isBetween(todayStart, todayEnd, null, '[]')
    );

    const weekOrders = deliveredOrders.filter(order =>
      moment(order.updatedAt).isAfter(weekStart)
    );

    const monthOrders = deliveredOrders.filter(order =>
      moment(order.updatedAt).isAfter(monthStart)
    );

    const todayEarnings = todayOrders.reduce(
      (sum, order) => sum + (order.deliveryEarning || 0),
      0
    );

    const weekEarnings = weekOrders.reduce(
      (sum, order) => sum + (order.deliveryEarning || 0),
      0
    );

    const monthEarnings = monthOrders.reduce(
      (sum, order) => sum + (order.deliveryEarning || 0),
      0
    );

    const groupedOrders = {};

    deliveredOrders.forEach(order => {
      const date = moment(order.updatedAt);
      let label;

      if (date.isSame(moment(), 'day')) {
        label = 'Today';
      } else if (date.isSame(moment().subtract(1, 'days'), 'day')) {
        label = 'Yesterday';
      } else if (date.isAfter(moment().subtract(7, 'days'))) {
        label = 'This Week';
      } else if (date.isAfter(moment().subtract(30, 'days'))) {
        label = 'This Month';
      } else {
        label = date.format('MMMM YYYY');
      }

      if (!groupedOrders[label]) {
        groupedOrders[label] = [];
      }

      groupedOrders[label].push({
        orderId: order._id,
        date: date.format('DD/MM/YYYY'),
        time: date.format('hh:mm A'),
        earning: order.deliveryEarning || 0,
        distance: order.deliveryDistance || 0,
        paymentType: order.paymentType || 'N/A'
      });
    });

    res.status(200).json({
      message: 'Earning history fetched successfully',
      success: true,
      data: {
        statistics: {
          totalEarnings: parseFloat(totalEarnings.toFixed(2)),
          todayEarnings: parseFloat(todayEarnings.toFixed(2)),
          weekEarnings: parseFloat(weekEarnings.toFixed(2)),
          monthEarnings: parseFloat(monthEarnings.toFixed(2)),
          totalOrders: deliveredOrders.length,
          todayOrders: todayOrders.length,
          weekOrders: weekOrders.length,
          monthOrders: monthOrders.length
        },
        orders: groupedOrders
      }
    });
  } catch (error) {
    logger.error('❌ Earning History Error:', error);
    res.status(500).json({
      message: 'Failed to fetch earnings',
      success: false,
      error: error.message
    });
  }
};

exports.getDeliveryOrderHistory = async (req, res) => {
  try {
    const deliveryBoyId = req.params.deliveryBoyId;

    const deliveryBoy = await DeliveryBoy.findById(deliveryBoyId);
    if (!deliveryBoy) {
      return res.status(404).json({
        message: 'Delivery boy not found',
        success: false,
        data: []
      });
    }

    const orders = await Order.find({
      assignedDeliveryBoy: deliveryBoyId
    }).sort({ updatedAt: -1 });

    if (!orders.length) {
      return res.status(200).json({
        message: 'No orders found',
        success: true,
        data: {
          statistics: {
            totalOrders: 0,
            delivered: 0,
            cancelled: 0,
            totalEarnings: 0,
            totalDistance: 0
          },
          orders: {}
        }
      });
    }

    const statistics = {
      totalOrders: orders.length,
      delivered: orders.filter(o => o.status === 'Delivered').length,
      cancelled: orders.filter(o => o.status === 'Cancelled').length,
      totalEarnings: orders
        .filter(o => o.status === 'Delivered')
        .reduce((sum, o) => sum + (o.deliveryEarning || 0), 0),
      totalDistance: parseFloat(orders.reduce((sum, o) => sum + (o.deliveryDistance || 0), 0).toFixed(1))
    };

    const groupedOrders = {};

    for (const order of orders) {
      const shop = await Shop.findById(order.shopId);

      const createdAt = moment(order.updatedAt);
      const today = moment();
      const yesterday = moment().subtract(1, 'day');

      let label;
      if (createdAt.isSame(today, 'day')) {
        label = 'Today';
      } else if (createdAt.isSame(yesterday, 'day')) {
        label = 'Yesterday';
      } else if (createdAt.isAfter(moment().subtract(7, 'days'))) {
        label = 'This Week';
      } else if (createdAt.isAfter(moment().subtract(30, 'days'))) {
        label = 'This Month';
      } else {
        label = createdAt.format('MMMM YYYY');
      }

      if (!groupedOrders[label]) {
        groupedOrders[label] = [];
      }

      let statusColor = 'grey';
      let statusIcon = 'clock';
      
      switch (order.status) {
        case 'Delivered':
          statusColor = 'green';
          statusIcon = 'check-circle';
          break;
        case 'Cancelled':
          statusColor = 'red';
          statusIcon = 'x-circle';
          break;
        case 'Accepted by Delivery Boy':
        case 'Reached Pickup':
        case 'Order Picked':
        case 'Reached Drop':
          statusColor = 'blue';
          statusIcon = 'truck';
          break;
        default:
          statusColor = 'orange';
          statusIcon = 'clock';
      }

      groupedOrders[label].push({
        orderId: order._id,
        date: createdAt.format('DD/MM/YYYY'),
        time: createdAt.format('hh:mm A'),
        status: order.status,
        statusColor,
        statusIcon,
        earning: parseFloat((order.deliveryEarning || 0).toFixed(2)),
        distance: parseFloat((order.deliveryDistance || 0).toFixed(1)),
        paymentType: order.paymentType || 'N/A',
        totalAmount: order.totalPayable || 0,
        shop: shop ? {
          name: shop.shopeDetails?.shopName || 'Unknown Shop',
          address: shop.shopeDetails?.shopAddress || 'N/A'
        } : null,
        customer: {
          name: order.deliveryAddress?.name || 'N/A',
          address: `${order.deliveryAddress?.address || ''}, ${order.deliveryAddress?.area || ''}, ${order.deliveryAddress?.place || ''}`.trim(),
          contact: order.deliveryAddress?.contact || 'N/A'
        }
      });
    }

    return res.status(200).json({
      message: 'Order history fetched successfully',
      success: true,
      data: {
        statistics,
        orders: groupedOrders
      }
    });
  } catch (error) {
    logger.error('❌ Order History Error:', error);
    return res.status(500).json({
      message: 'Failed to fetch delivery order history',
      success: false,
      data: error.message
    });
  }
};

exports.updateDeliveryBoyDetails = async (req, res) => {
  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Request body is missing or empty',
      });
    }

    const { deliveryBoyId } = req.params;
    const {
      name, email, phone, countryCode, dob, licenseNo,
      accountVerify, isOnline, profileImage, licenseImage,
      areaAssigned, emiratesId, operatingHours, agencyAddress,
      city, latitude, longitude, availability, agencyId,
    } = req.body;

    logger.info(`📦 Update payload received: ${JSON.stringify(req.body)}`);

    const deliveryBoy = await DeliveryBoy.findById(deliveryBoyId);

    if (!deliveryBoy) {
      return res.status(404).json({
        message: 'Delivery Boy not found',
        success: false
      });
    }

    if (name !== undefined) deliveryBoy.name = name;
    if (email !== undefined) deliveryBoy.email = email;
    if (phone !== undefined) deliveryBoy.phone = phone;
    if (countryCode !== undefined) deliveryBoy.countryCode = countryCode;
    if (dob !== undefined) deliveryBoy.dob = dob;
    if (licenseNo !== undefined) deliveryBoy.licenseNo = licenseNo;
    if (accountVerify !== undefined) deliveryBoy.accountVerify = accountVerify;
    if (isOnline !== undefined) deliveryBoy.isOnline = isOnline;
    if (profileImage !== undefined) deliveryBoy.profileImage = profileImage;
    if (licenseImage !== undefined) deliveryBoy.licenseImage = licenseImage;
    if (areaAssigned !== undefined) deliveryBoy.areaAssigned = areaAssigned;
    if (emiratesId !== undefined) deliveryBoy.emiratesId = emiratesId;
    if (operatingHours !== undefined) deliveryBoy.operatingHours = operatingHours;
    if (agencyAddress !== undefined) deliveryBoy.agencyAddress = agencyAddress;
    if (city !== undefined) deliveryBoy.city = city;
    if (latitude !== undefined) deliveryBoy.latitude = latitude;
    if (longitude !== undefined) deliveryBoy.longitude = longitude;
    if (availability !== undefined) deliveryBoy.availability = availability;
    if (agencyId !== undefined) deliveryBoy.agencyId = agencyId;

    await deliveryBoy.save();

    logger.info('✅ Delivery boy updated successfully');

    return res.status(200).json({
      message: 'Delivery Boy details updated successfully',
      success: true,
      data: deliveryBoy
    });

  } catch (error) {
    logger.error('❌ Update Delivery Boy Error:', error);
    return res.status(500).json({
      message: 'Failed to update delivery boy details',
      success: false,
      error: error.message
    });
  }
};

exports.registerDeliveryBoy = async (req, res) => {
  try {
    const deliveryBoy = new DeliveryBoy(req.body);
    await deliveryBoy.save();
    res.status(201).json({
      success: true,
      message: 'Delivery boy registered successfully',
      data: deliveryBoy
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error registering delivery boy',
      error: error.message
    });
  }
};

exports.deleteDeliveryBoyById = async (req, res) => {
  const { id } = req.params;
  try {
    const deleted = await DeliveryBoy.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Delivery boy not found',
        data: []
      });
    }
    res.status(200).json({
      success: true,
      message: 'Delivery boy deleted successfully',
      data: deleted
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

exports.getDeliveryBoyReport = async (req, res) => {
  try {
    const { deliveryBoyId } = req.params;
    const { from, to, status } = req.query;

    logger.info(`📊 Fetching detailed report for delivery boy: ${deliveryBoyId}`);

    const deliveryBoy = await DeliveryBoy.findById(deliveryBoyId)
      .populate({
        path: 'agencyId',
        select: 'agencyDetails.agencyName agencyDetails.agencyMail agencyDetails.agencyContact agencyDetails.agencyAddress agencyDetails.profileImage agencyDetails.city agencyDetails.emirates agencyDetails.payoutType isVerified',
      })
      .lean();

    if (!deliveryBoy) {
      return res.status(404).json({
        success: false,
        message: 'Delivery boy not found',
      });
    }

    const orderFilter = { assignedDeliveryBoy: deliveryBoyId };

    if (from && to) {
      orderFilter.createdAt = {
        $gte: new Date(from),
        $lte: new Date(new Date(to).setHours(23, 59, 59, 999)),
      };
    }

    if (status) {
      orderFilter.status = status;
    }

    const orders = await Order.find(orderFilter)
      .populate('userId', 'name email phone')
      .populate('shopId', 'shopeDetails.shopName shopeDetails.shopAddress shopeDetails.shopContact shopeDetails.shopLocation')
      .populate('agencyId', 'agencyDetails.agencyName agencyDetails.agencyContact')
      .sort({ createdAt: -1 })
      .lean();

    const totalOrders       = orders.length;
    const deliveredOrders   = orders.filter(o => o.status === 'Delivered');
    const cancelledOrders   = orders.filter(o => o.cancellation?.isCancelled);
    const pendingOrders     = orders.filter(o => !['Delivered', 'Cancelled'].includes(o.status) && !o.cancellation?.isCancelled);

    const totalEarnings      = deliveredOrders.reduce((sum, o) => sum + (o.deliveryEarning || 0), 0);
    const totalDistance      = deliveredOrders.reduce((sum, o) => sum + (o.deliveryDistance || 0), 0);
    const avgEarningPerOrder = deliveredOrders.length > 0 ? totalEarnings / deliveredOrders.length : 0;
    const avgDistance        = deliveredOrders.length > 0 ? totalDistance / deliveredOrders.length : 0;
    const completionRate     = totalOrders > 0 ? (deliveredOrders.length / totalOrders) * 100 : 0;
    const totalOrderValue    = deliveredOrders.reduce((sum, o) => sum + (o.totalPayable || 0), 0);

    const codOrders  = deliveredOrders.filter(o => o.paymentType === 'COD').length;
    const cardOrders = deliveredOrders.filter(o => o.paymentType === 'CARD').length;

    let totalDeliveryMinutes = 0;
    let ordersWithTime = 0;

    deliveredOrders.forEach(order => {
      const history = order.statusHistory || [];
      const acceptedEntry  = history.find(h => h.status === 'Accepted by Delivery Boy');
      const deliveredEntry = history.find(h => h.status === 'Delivered');

      if (acceptedEntry?.date && deliveredEntry?.date) {
        const diffMs = new Date(deliveredEntry.date) - new Date(acceptedEntry.date);
        totalDeliveryMinutes += diffMs / 60000;
        ordersWithTime++;
      }
    });

    const avgDeliveryMinutes = ordersWithTime > 0
      ? Math.round(totalDeliveryMinutes / ordersWithTime)
      : null;

    const monthlyBreakdown = {};
    orders.forEach(order => {
      const monthKey = new Date(order.createdAt).toLocaleString('en-US', { month: 'short', year: 'numeric' });
      if (!monthlyBreakdown[monthKey]) {
        monthlyBreakdown[monthKey] = { orders: 0, earnings: 0, delivered: 0 };
      }
      monthlyBreakdown[monthKey].orders++;
      if (order.status === 'Delivered') {
        monthlyBreakdown[monthKey].delivered++;
        monthlyBreakdown[monthKey].earnings += order.deliveryEarning || 0;
      }
    });

    const formattedOrders = orders.map(order => ({
      orderId:          order._id,
      shortId:          order._id.toString().slice(-6).toUpperCase(),
      status:           order.status,
      isCancelled:      order.cancellation?.isCancelled || false,
      paymentType:      order.paymentType,
      paymentStatus:    order.paymentStatus,
      totalPayable:     order.totalPayable,
      deliveryDistance: order.deliveryDistance,
      deliveryEarning:  order.deliveryEarning,
      deliveredAt:      order.deliveredAt || null,
      createdAt:        order.createdAt,
      itemCount:        order.items?.length || 0,
      statusHistory:    order.statusHistory || [],
      customer: {
        name:    order.userId?.name || 'N/A',
        email:   order.userId?.email || 'N/A',
        phone:   order.userId?.phone || 'N/A',
        address: order.deliveryAddress?.address || 'N/A',
        area:    order.deliveryAddress?.area || 'N/A',
        place:   order.deliveryAddress?.place || 'N/A',
        lat:     order.deliveryAddress?.latitude,
        lng:     order.deliveryAddress?.longitude,
      },
      shop: {
        name:     order.shopId?.shopeDetails?.shopName    || 'N/A',
        address:  order.shopId?.shopeDetails?.shopAddress || 'N/A',
        contact:  order.shopId?.shopeDetails?.shopContact || 'N/A',
        location: order.shopId?.shopeDetails?.shopLocation || null,
      },
      items: order.items?.map(item => ({
        partName:        item.snapshot?.partName    || 'N/A',
        partNumber:      item.snapshot?.partNumber  || 'N/A',
        quantity:        item.quantity,
        price:           item.snapshot?.price,
        discountedPrice: item.snapshot?.discountedPrice,
        image:           item.snapshot?.image,
      })) || [],
    }));

    const agency = deliveryBoy.agencyId
      ? {
          id:           deliveryBoy.agencyId._id,
          name:         deliveryBoy.agencyId.agencyDetails?.agencyName    || 'N/A',
          email:        deliveryBoy.agencyId.agencyDetails?.agencyMail    || 'N/A',
          contact:      deliveryBoy.agencyId.agencyDetails?.agencyContact || 'N/A',
          address:      deliveryBoy.agencyId.agencyDetails?.agencyAddress || 'N/A',
          profileImage: deliveryBoy.agencyId.agencyDetails?.profileImage  || null,
          city:         deliveryBoy.agencyId.agencyDetails?.city          || 'N/A',
          emirates:     deliveryBoy.agencyId.agencyDetails?.emirates      || [],
          payoutType:   deliveryBoy.agencyId.agencyDetails?.payoutType    || 'monthly',
          isVerified:   deliveryBoy.agencyId.isVerified,
        }
      : null;

    return res.status(200).json({
      success: true,
      message: 'Delivery boy report fetched successfully',
      data: {
        deliveryBoy: {
          id:               deliveryBoy._id,
          name:             deliveryBoy.name,
          email:            deliveryBoy.email,
          phone:            deliveryBoy.phone,
          dob:              deliveryBoy.dob,
          profileImage:     deliveryBoy.profileImage,
          licenseImage:     deliveryBoy.licenseImage,
          licenseNo:        deliveryBoy.licenseNo,
          emiratesId:       deliveryBoy.emiratesId,
          city:             deliveryBoy.city,
          areaAssigned:     deliveryBoy.areaAssigned,
          isOnline:         deliveryBoy.isOnline,
          availability:     deliveryBoy.availability,
          accountVerify:    deliveryBoy.accountVerify,
          activeDeviceInfo: deliveryBoy.activeDeviceInfo,
          lastLoginAt:      deliveryBoy.lastLoginAt,
          latitude:         deliveryBoy.latitude,
          longitude:        deliveryBoy.longitude,
          createdAt:        deliveryBoy.createdAt,
        },
        agency,
        stats: {
          totalOrders,
          deliveredOrders:    deliveredOrders.length,
          cancelledOrders:    cancelledOrders.length,
          pendingOrders:      pendingOrders.length,
          completionRate:     +completionRate.toFixed(1),
          totalEarnings:      +totalEarnings.toFixed(2),
          avgEarningPerOrder: +avgEarningPerOrder.toFixed(2),
          totalDistance:      +totalDistance.toFixed(2),
          avgDistance:        +avgDistance.toFixed(2),
          totalOrderValue:    +totalOrderValue.toFixed(2),
          avgDeliveryMinutes,
          codOrders,
          cardOrders,
        },
        monthlyBreakdown,
        orders: formattedOrders,
        meta: {
          totalOrdersFetched: formattedOrders.length,
          filters: { from, to, status },
          generatedAt: new Date().toISOString(),
        },
      },
    });

  } catch (error) {
    logger.error('❌ Delivery Boy Report Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch delivery boy report',
      error: error.message,
    });
  }
};