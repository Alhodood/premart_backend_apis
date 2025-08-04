const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const DeliveryBoy = require('../models/DeliveryBoy');
const { DeliveryAgency } = require('../models/DeliveryAgency');
const Order = require('../models/Order');
const { Shop } = require('../models/Shop');
const axios = require('axios');
const { Product } = require('../models/Product');
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const geolib = require('geolib');
const Payment = require('../models/Payment');
const moment = require('moment');
const { getIO } = require('../sockets/socket');


// Calculate distance between 2 geo points (Haversine)


const twilio = require('twilio');
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTHTOKEN);

exports.sendOtpToDeliveryBoy = async (req, res) => {
  const { phone } = req.body;

  if (!phone) {
    return res.status(400).json({
      message: 'Phone is required',
      success: false
    });
  }

  try {
    await client.verify.v2.services(process.env.TWILIO_SERVICE_SID)
      .verifications
      .create({ to: phone, channel: 'sms' });

    return res.status(200).json({
      message: 'OTP sent successfully',
      success: true
    });
  } catch (err) {
    console.error('Send OTP Error:', err);
    res.status(500).json({
      message: 'Failed to send OTP',
      success: false,
      error: err.message
    });
  }
};

// Resend OTP to delivery boy
exports.resendOtpToDeliveryBoy = async (req, res) => {
  const { phone } = req.body;

  if (!phone) {
    return res.status(400).json({
      message: 'Phone is required',
      success: false
    });
  }

  try {
    // Re-trigger OTP sending using Twilio
    await client.verify.v2.services(process.env.TWILIO_SERVICE_SID)
      .verifications
      .create({ to: phone, channel: 'sms' });

    return res.status(200).json({
      message: 'OTP resent successfully',
      success: true
    });
  } catch (err) {
    console.error('Resend OTP Error:', err);
    res.status(500).json({
      message: 'Failed to resend OTP',
      success: false,
      error: err.message
    });
  }
};

exports.verifyOtpForDeliveryBoy = async (req, res) => {
  const { phone, code } = req.body;

  if (!phone || !code) {
    return res.status(400).json({
      message: 'Phone and OTP code are required',
      success: false
    });
  }

  try {
    const verification = await client.verify.v2.services(process.env.TWILIO_SERVICE_SID)
      .verificationChecks
      .create({ to: phone, code });

    if (verification.status === 'approved') {
      let deliveryBoy = await DeliveryBoy.findOne({ phone });

      // If not found, register new delivery boy with required details from req.body
      if (!deliveryBoy) {
        const { countryCode, latitude, longitude } = req.body;
        if (!countryCode || latitude === undefined || longitude === undefined) {
          return res.status(400).json({
            message: 'Missing details for registration (countryCode, latitude, longitude)',
            success: false
          });
        }

        deliveryBoy = new DeliveryBoy({
          phone,
          countryCode,
          latitude,
          longitude,
          isOnline: false,
          role: 'deliveryBoy'
        });
        await deliveryBoy.save();
      }

      return res.status(200).json({
        message: 'OTP verified successfully',
        success: true,
        data: deliveryBoy
      });
    } else {
      return res.status(401).json({
        message: 'Invalid OTP',
        success: false
      });
    }
  } catch (err) {
    console.error('Verify OTP Error:', err);
    res.status(500).json({
      message: 'OTP verification failed',
      success: false,
      error: err.message
    });
  }
};


  exports.updateDeliveryBoy = async (req, res) => {
    try {
      const deliveryBoyId = req.params.deliveryBoyId;
      const updateData = req.body;
  
      const updatedDeliveryBoy = await DeliveryBoy.findByIdAndUpdate(
        deliveryBoyId,
        updateData,
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
        message: 'Delivery Boy updated successfully',
        success: true,
        data: updatedDeliveryBoy
      });
  
    } catch (error) {
      console.error('Update Delivery Boy Error:', error);
      res.status(500).json({
        message: 'Failed to update delivery boy',
        success: false,
        data: error.message
      });
    }
  };

exports.getAllDeliveryBoys = async (req, res) => {
  try {
    const deliveryBoys = await DeliveryBoy.find({}, {
      name: 1,
      phone: 1,
      agencyId: 1,
      accountVerify: 1,
      isOnline: 1,
      latitude: 1,
      longitude: 1,
      availability: 1,
      createdAt: 1,
      assignedOrders: 1,
      emiratesId: 1,
      areaAssigned: 1,
      city: 1,
      dob: 1,
      licenseNo: 1,
      email: 1,
    }).lean();

    const formatted = deliveryBoys.map(boy => ({
      _id: boy._id,
      name: boy.name || "NA",
      phone: boy.phone || "NA",
      agencyId: boy.agencyId || "NA",
      emiratesId: boy.emiratesId || "NA",
      areaAssigned: boy.areaAssigned || "NA",
      city: boy.city || "NA",
      dob: boy.dob || "NA",
      licenseNo: boy.licenseNo || "NA",
      email: boy.email || "NA",
      accountVerify: boy.accountVerify !== undefined && boy.accountVerify !== null ? boy.accountVerify : "NA",
      isOnline: boy.isOnline !== undefined && boy.isOnline !== null ? boy.isOnline : "NA",
      latitude: boy.latitude !== undefined && boy.latitude !== null ? boy.latitude : "NA",
      longitude: boy.longitude !== undefined && boy.longitude !== null ? boy.longitude : "NA",
      availability: boy.availability !== undefined && boy.availability !== null ? boy.availability : "NA",
      createdAt: boy.createdAt || "NA",
      assignedOrder: Array.isArray(boy.assignedOrders) ? boy.assignedOrders.length : 0
    }));

    res.status(200).json({
      message: "Delivery boys fetched successfully",
      success: true,
      data: formatted
    });
  } catch (err) {
    console.error("Error fetching delivery boys:", err);
    res.status(500).json({ success: false, message: "Failed to fetch delivery boys" });
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
      console.error('Delete Delivery Boy Error:', error);
      res.status(500).json({
        message: 'Failed to delete delivery boy',
        success: false,
        data: error.message
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
      console.error('Update Live Location Error:', error);
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

    // ✅ 1. Validate delivery boy
    const deliveryBoy = await DeliveryBoy.findById(deliveryBoyId);
    if (!deliveryBoy) {
      return res.status(404).json({
        message: 'Delivery Boy not found',
        success: false,
        data: []
      });
    }

    // ✅ 2. Must be online
    if (!deliveryBoy.isOnline) {
      return res.status(200).json({
        message: 'You are offline. No assigned orders shown.',
        success: true,
        data: []
      });
    }

    // ✅ 3. Fetch assigned orders
    // Use direct ObjectId comparison for assignedDeliveryBoy and $in for orderStatus.
    const assignedOrders = await Order.find({
      assignedDeliveryBoy: new mongoose.Types.ObjectId(deliveryBoyId),
      orderStatus: { $in: ['Delivery Boy Assigned', 'Accepted by Delivery Boy', 'Picked Up'] }
    }).sort({ createdAt: -1 });

    // Log the count and details of fetched assigned orders
    console.log(`📦 Found assigned orders:`, assignedOrders.length);
    assignedOrders.forEach(o => console.log(`- ${o._id} | ${o.orderStatus}`));

    const results = [];

    for (const order of assignedOrders) {
      // 🏪 Fetch shop details
      const shop = await Shop.findById(order.shopId);
      const shopLocation = shop?.shopeDetails?.shopLocation;
      const [shopLat, shopLng] = shopLocation?.split(',').map(Number) || [];

      // 👟 Delivery Boy coordinates
      const { latitude: boyLat, longitude: boyLng } = deliveryBoy;

      // 👤 Customer coordinates
      const { latitude: customerLat, longitude: customerLng } = order.deliveryAddress;

      // Log all coordinates
      console.log("boyLat,boyLng:", boyLat, boyLng);
      console.log("shopLat,shopLng:", shopLat, shopLng);
      console.log("customerLat,customerLng:", customerLat, customerLng);

      // 🧮 Distance calculations
      const pickupDistanceKm = geolib.getDistance(
        { latitude: boyLat, longitude: boyLng },
        { latitude: shopLat, longitude: shopLng }
      ) / 1000;

      const dropDistanceKm = geolib.getDistance(
        { latitude: shopLat, longitude: shopLng },
        { latitude: customerLat, longitude: customerLng }
      ) / 1000;

      // 🧮 ETA using Google Distance Matrix API
      let pickupTime = "N/A";
      let dropTime = "N/A";

      if (
        boyLat && boyLng &&
        shopLat && shopLng &&
        customerLat && customerLng
      ) {
        try {
          // Pickup time calculation
          const pickupUrl = encodeURI(`https://maps.googleapis.com/maps/api/distancematrix/json?origins=${boyLat},${boyLng}&destinations=${shopLat},${shopLng}&key=${GOOGLE_MAPS_API_KEY}`);
          const pickupResponse = await axios.get(pickupUrl);
          console.log("✅ Pickup API Full Response:", pickupResponse.data);
          pickupElement = pickupResponse.data?.rows?.[0]?.elements?.[0];
          pickupTime = pickupElement?.status === 'OK' && pickupElement?.duration
            ? pickupElement.duration.text
            : 'N/A';
          console.log("⏱️ pickupTime:", pickupTime);

          // Drop time calculation
          const dropUrl = encodeURI(`https://maps.googleapis.com/maps/api/distancematrix/json?origins=${shopLat},${shopLng}&destinations=${customerLat},${customerLng}&key=${GOOGLE_MAPS_API_KEY}`);
          const dropResponse = await axios.get(dropUrl);
          console.log("✅ Drop API Full Response:", dropResponse.data);
          dropElement = dropResponse.data?.rows?.[0]?.elements?.[0];
          dropTime = dropElement?.status === 'OK' && dropElement?.duration
            ? dropElement.duration.text
            : 'N/A';
          console.log("⏱️ dropTime:", dropTime);
        } catch (err) {
          console.error("❌ Google Maps API Error:", err?.response?.data || err.message);
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

      // ✅ Fetch payment details
      const payment = await Payment.findOne({ orderId: order._id });
      const paymentInfo = {
        method: payment?.paymentMethod || 'Unknown',
        status: payment?.paymentStatus || 'Unpaid'
      };

      // 📦 Final response per order
      results.push({
        orderId: order._id, // 🔁 rename _id
        ...order._doc,
        _id: undefined, // remove _id key
        shopDetails: shop, // ✅ Full shop object
        pickupTime,
        dropTime,
        deliveryEarning: order.deliveryEarning,
        pickupDistance: `${pickupDistanceKm.toFixed(2)} km`,
        dropDistance: `${dropDistanceKm.toFixed(2)} km`,
        totalEstimatedTime,
        payment: paymentInfo
      });
    }

    // Log the count of final formatted results before returning
    console.log(`✅ Final formatted results count:`, results.length);

    return res.status(200).json({
      message: 'Assigned orders fetched successfully',
      success: true,
      data: results
    });

  } catch (error) {
    console.error('View Assigned Orders Error:', error);
    return res.status(500).json({
      message: 'Failed to fetch assigned orders',
      success: false,
      data: error.message
    });
  }
};

// Get nearby assigned orders for delivery boy (within 20km, orderStatus='Delivery Boy Assigned')
exports.getNearbyAssignedOrders = async (req, res) => {
  try {
    const deliveryBoyId = req.params.deliveryBoyId;

    // 1. Validate delivery boy and get location
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

    // 2. Fetch orders within 20km radius and status 'Delivery Boy Assigned'
    // Ensure deliveryAddress is populated
    const assignedOrders = await Order.find({ orderStatus: 'Delivery Boy Assigned' }).populate('deliveryAddress');

    const formattedNearbyOrders = [];

    for (const order of assignedOrders) {
      const shop = await Shop.findById(order.shopId);
      const shopLocation = shop?.shopeDetails?.shopLocation;
      if (!shopLocation) continue;

      const [shopLat, shopLng] = shopLocation.split(',').map(Number);

      const pickupDistance = geolib.getDistance(
        { latitude: boyLat, longitude: boyLng },
        { latitude: shopLat, longitude: shopLng }
      ) / 1000;

      if (pickupDistance > RANGE_KM) continue;

      // Calculate pickupTime (ETA from delivery boy to shop)
      let pickupTime = "N/A";
      try {
        const pickupUrl = encodeURI(`https://maps.googleapis.com/maps/api/distancematrix/json?origins=${boyLat},${boyLng}&destinations=${shopLat},${shopLng}&key=${GOOGLE_MAPS_API_KEY}`);
        const pickupResponse = await axios.get(pickupUrl);
        const pickupElement = pickupResponse.data?.rows?.[0]?.elements?.[0];
        pickupTime = pickupElement?.status === 'OK' && pickupElement?.duration
          ? pickupElement.duration.text
          : 'N/A';
      } catch (err) {
        pickupTime = "N/A";
      }

      // Calculate dropDistance and dropTime (shop to customer)
      let dropDistance = 0;
      let dropTime = "N/A";
      const customerLat = order?.deliveryAddress?.latitude;
      const customerLng = order?.deliveryAddress?.longitude;
      if (shopLat && shopLng && customerLat && customerLng) {
        dropDistance = geolib.getDistance(
          { latitude: shopLat, longitude: shopLng },
          { latitude: customerLat, longitude: customerLng }
        ) / 1000;
        try {
          const dropUrl = encodeURI(`https://maps.googleapis.com/maps/api/distancematrix/json?origins=${shopLat},${shopLng}&destinations=${customerLat},${customerLng}&key=${GOOGLE_MAPS_API_KEY}`);
          const dropResponse = await axios.get(dropUrl);
          const dropElement = dropResponse.data?.rows?.[0]?.elements?.[0];
          dropTime = dropElement?.status === 'OK' && dropElement?.duration
            ? dropElement.duration.text
            : 'N/A';
        } catch (err) {
          dropTime = "N/A";
        }
      }

      // Helper: parse time string to minutes (copied from viewAssignedOrders)
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

      // Try to get full product details if populated (if not, fallback to order.products, etc.)
      let fullProductDetails = [];
      if (order.products && Array.isArray(order.products)) {
        // Optionally, populate product info here if needed.
        fullProductDetails = order.products;
      }

      // Shop details formatting
      const shopDetails = {
        shopName: shop?.shopeDetails?.shopName || '',
        shopAddress: shop?.shopeDetails?.shopAddress || '',
        shopContact: shop?.shopeDetails?.shopContact || '',
      };

      // Delivery details formatting
      const deliveryDetails = {
        deliveryBoyId: order.assignedDeliveryBoy || null,
        orderStatus: order.orderStatus,
        pickupDistance: `${pickupDistance.toFixed(2)} km`,
        pickupTime,
        dropDistance: `${dropDistance ? dropDistance.toFixed(2) : '0.00'} km`,
        dropTime,
        deliveryEarnings: order.deliveryEarning || 0,
      };

      // Delivery address formatting (new key)
      const deliveryAddress = {
        name: order?.deliveryAddress?.name || "N/A",
        address: order?.deliveryAddress?.address || "N/A",
        contact: order?.deliveryAddress?.contact || "N/A",
        area: order?.deliveryAddress?.area || "N/A",
        place: order?.deliveryAddress?.place || "N/A",
        latitude: order?.deliveryAddress?.latitude || null,
        longitude: order?.deliveryAddress?.longitude || null
      };

      formattedNearbyOrders.push({
        orderId: order._id,
        shopDetails,
        deliveryDetails,
        deliveryAddress,
        fullProductDetails,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt
      });
    }

    return res.status(200).json({
      message: "Nearby assigned orders fetched successfully",
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

exports.getOngoingOrdersForDeliveryBoy = async (req, res) => {
  try {
    const { deliveryBoyId } = req.params;

    if (!deliveryBoyId) {
      return res.status(400).json({ success: false, message: 'Delivery Boy ID is required' });
    }

    const ongoingOrders = await Order.find({
      deliveryBoyId,
      orderStatus: { $nin: ['Delivered', 'Cancelled'] }
    }).sort({ updatedAt: -1 });

    return res.status(200).json({
      success: true,
      message: 'Ongoing orders fetched successfully',
      data: ongoingOrders,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching ongoing orders',
      error: err.message,
    });
  }
};
  
  // Helper function
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
      const { action, deliveryBoyId } = req.body; // add deliveryBoyId in body

      if (!orderId || !action || !deliveryBoyId) {
        return res.status(400).json({
          message: 'OrderId, action and deliveryBoyId are required',
          success: false,
          data: []
        });
      }

      // Validate delivery boy
      const deliveryBoy = await DeliveryBoy.findById(deliveryBoyId);
      if (!deliveryBoy) {
        return res.status(404).json({
          message: 'Delivery Boy not found',
          success: false,
          data: []
        });
      }

      if (action === "accept") {
        // Accept logic: update orderStatus, assignedDeliveryBoy, push status, and update delivery boy's assignedOrders
        const order = await Order.findById(orderId);
        if (!order) {
          return res.status(404).json({
            message: 'Order not found',
            success: false,
            data: []
          });
        }
        order.orderStatus = "Accepted by Delivery Boy";
        order.assignedDeliveryBoy = deliveryBoyId;
        // Add status to orderStatusList
        order.orderStatusList.push({ status: 'Order Accepted By Delivery Boy', date: new Date() });
        await order.save();

        await DeliveryBoy.findByIdAndUpdate(
          deliveryBoyId,
          { $addToSet: { assignedOrders: orderId } },
          { new: true }
        );

        return res.status(200).json({
          message: `Order accepted successfully`,
          success: true,
          data: order
        });
      } else if (action === "reject") {
        // Reject logic: update assignedDeliveryBoy, orderStatus, and remove from delivery boy's assignedOrders
        const updatedOrder = await Order.findByIdAndUpdate(
          orderId,
          {
            assignedDeliveryBoy: null,
            orderStatus: "Pending for Delivery Assignment"
          },
          { new: true }
        );

        // 🧼 Remove from delivery boy's assignedOrders if rejected
        await DeliveryBoy.findByIdAndUpdate(
          deliveryBoyId,
          { $pull: { assignedOrders: orderId } },
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
          message: `Order rejected successfully`,
          success: true,
          data: updatedOrder
        });
      } else {
        return res.status(400).json({
          message: 'Invalid action, must be accept or reject',
          success: false,
          data: []
        });
      }

    } catch (error) {
      console.error('DeliveryBoy Accept/Reject Error:', error);
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

    // Two-step update: fetch, update fields, push to orderStatusList, and save
    const updatedOrder = await Order.findById(orderId);
    if (!updatedOrder) {
      return res.status(404).json({
        message: 'Order not found',
        success: false,
        data: []
      });
    }

    updatedOrder.orderStatus = newStatus;
    updatedOrder.orderStatusList.push({ status: newStatus, date: new Date() });
    await updatedOrder.save();

    // If the status is set to Delivered, add logic for agency payment record
    if (updatedOrder.orderStatus === 'Delivered') {
      // Calculate current month string
      const currentMonth = new Date().toLocaleString('default', { month: 'long', year: 'numeric' }); // e.g. May 2025
      console.log('Calculated month string:', currentMonth);
      const deliveryBoy = await DeliveryBoy.findById(updatedOrder.assignedDeliveryBoy).lean();
      console.log('Delivery boy:', deliveryBoy);
      if (!deliveryBoy?.agencyId) {
        console.log('No agencyId found for delivery boy');
      }
      if (deliveryBoy && deliveryBoy.agencyId) {
        const DeliveryAgency = require('../models/DeliveryAgency').DeliveryAgency;
        const agency = await DeliveryAgency.findById(deliveryBoy.agencyId);
        console.log('Fetched agency:', agency);
        if (agency) {
          // Find existing payment record for the month
          const existingRecord = agency.paymentRecords.find(record => record.month === currentMonth);
          if (existingRecord) {
            existingRecord.amount += 10;
          } else {
            agency.paymentRecords.push({
              amount: 10,
              month: currentMonth,
              paymentMethod: 'Bank Transfer',
              status: 'Paid',
              paymentDate: new Date(),
              transactionId: `DEL-${Date.now()}`
            });
          }
          console.log('Updated payment records:', agency.paymentRecords);
          await agency.save();
          console.log('Agency saved with updated payments');
        }
      }
    }

    // ✅ Get Socket.IO only when needed
    try {
      const io = getIO();
      io.emit('order_status_changed', {
        orderId: updatedOrder._id,
        status: updatedOrder.orderStatus,
        shopId: updatedOrder.shopId,
        deliveryBoyId: updatedOrder.assignedDeliveryBoy,
        updatedAt: updatedOrder.updatedAt,
      });
    } catch (socketErr) {
      console.warn("Socket.IO not initialized yet:", socketErr.message);
    }

    return res.status(200).json({
      message: 'Order status updated successfully',
      success: true,
      data: updatedOrder
    });

  } catch (error) {
    console.error('DeliveryBoy Update Status Error:', error);
    res.status(500).json({
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
      console.error('Raise Delivery Issue Error:', error);
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
        data: []
      });
    }

    const deliveryBoys = await DeliveryBoy.find({ agencyId });

    return res.status(200).json({
      message: 'Delivery boys fetched successfully',
      success: true,
      count: deliveryBoys.length,
      data: deliveryBoys
    });
  } catch (error) {
    console.error('Get Delivery Boys Error:', error);
    res.status(500).json({
      message: 'Failed to fetch delivery boys',
      success: false,
      data: error.message
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
    console.log('Requested Delivery Boy ID:', deliveryBoyId);

    const deliveryBoy = await DeliveryBoy.findById(deliveryBoyId);
    console.log('Fetched Delivery Boy:', deliveryBoy);
    if (!deliveryBoy || (deliveryBoy.role?.toLowerCase() !== 'deliveryboy')) {
      console.log('Validation failed - either not found or role mismatch:', deliveryBoy?.role);
      return res.status(404).json({
        success: false,
        message: "Delivery Boy not found"
      });
    }

    deliveryBoy.isOnline = !deliveryBoy.isOnline;
    await deliveryBoy.save();

    res.status(200).json({
      success: true,
      message: `Status updated to ${deliveryBoy.isOnline ? 'Online' : 'Offline'}`,
      isOnline: deliveryBoy.isOnline
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to toggle availability",
      error: err.message
    });
  }
};






// Haversine distance function (in km)
const getDistanceInKm = (lat1, lon1, lat2, lon2) => {
  console.log(`Calculating distance between (${lat1}, ${lon1}) and (${lat2}, ${lon2})`);
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

// Get top 6 nearby order areas (custom deliveryAddress structure)
exports.getNearbyTopOrderAreas = async (req, res) => {
  try {
    // Fetch all delivered orders with valid deliveryAddress coordinates
    const orders = await Order.find({
      orderStatus: "Delivered",
      "deliveryAddress.latitude": { $exists: true, $ne: null },
      "deliveryAddress.longitude": { $exists: true, $ne: null }
    });

    // Aggregate by area & place, count orders, keep coordinates and a sample delivery address
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

    // Format as required: top 6, use actual delivery address sample from grouped orders
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
    console.error("Nearby Top Areas Error:", error);
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

    const orders = await Order.find({
      assignedDeliveryBoy: deliveryBoyId,
      orderStatus: 'Delivered'
    });

    const result = {};

    orders.forEach(order => {
      const date = moment(order.updatedAt);
      let label;

      if (date.isSame(moment(), 'day')) {
        label = 'Today';
      } else if (date.isSame(moment().subtract(1, 'days'), 'day')) {
        label = 'Yesterday';
      } else {
        label = date.format('DD MMM YYYY');
      }

      if (!result[label]) result[label] = [];

      result[label].push({
        orderId: order._id,
        date: date.format('DD/MM/YYYY'),
        earning: `${order.deliveryEarning} AED`
      });
    });

    res.status(200).json({
      message: 'Earning history fetched successfully',
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Earning History Error:', error);
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

    // 1. Validate delivery boy
    const deliveryBoy = await DeliveryBoy.findById(deliveryBoyId);
    if (!deliveryBoy) {
      return res.status(404).json({
        message: 'Delivery boy not found',
        success: false,
        data: [],
      });
    }

    // 2. Fetch all assigned orders
    const orders = await Order.find({ assignedDeliveryBoy: deliveryBoyId }).sort({ createdAt: -1 });
    if (!orders.length) {
      return res.status(200).json({ message: 'No orders found', success: true, data: [] });
    }

    // 3. Enrich with date formatting and payment info
    const formatted = await Promise.all(
      orders.map(async (order) => {
        const payment = await Payment.findOne({ orderId: order._id });
        const createdAt = moment(order.createdAt);
        const today = moment();
        const yesterday = moment().subtract(1, 'day');

        let label = createdAt.isSame(today, 'day')
          ? 'Today'
          : createdAt.isSame(yesterday, 'day')
          ? 'Yesterday'
          : createdAt.format('dddd');

        return {
          orderId: order._id,
          date: createdAt.format('DD/MM/YYYY'),
          day: label,
          orderStatus: order.orderStatus,
          earning: parseFloat(order.deliveryEarning || 0),
          paymentType: order.paymentType || 'N/A',
          deliveryAddress: `${order.deliveryAddress.flatNumber}, ${order.deliveryAddress.area}, ${order.deliveryAddress.place}`,
        };
      })
    );

    return res.status(200).json({
      message: 'Order history fetched successfully',
      success: true,
      data: formatted,
    });

  } catch (error) {
    console.error('Order History Error:', error);
    return res.status(500).json({
      message: 'Failed to fetch delivery order history',
      success: false,
      data: error.message,
    });
  }
};


exports.updateDeliveryBoyDetails = async (req, res) => {
  try {
    if (!req.body) {
      return res.status(400).json({
        success: false,
        message: 'Request body is missing',
      });
    }

    const { deliveryBoyId } = req.params;
    const {
      name,
      email,
      phone,
      emiratesId,
      operatingHours,
      agencyAddress,
      city
    } = req.body;

    const deliveryBoy = await DeliveryBoy.findById(deliveryBoyId);

    if (!deliveryBoy) {
      return res.status(404).json({
        message: 'Delivery Boy not found',
        success: false
      });
    }

    // Update fields if provided
    if (name) deliveryBoy.name = name;
    if (email) deliveryBoy.email = email;
    if (phone) deliveryBoy.phone = phone;
    if (emiratesId) deliveryBoy.emiratesId = emiratesId;
    if (operatingHours) deliveryBoy.operatingHours = operatingHours;
    if (agencyAddress) deliveryBoy.agencyAddress = agencyAddress;
    if (city) deliveryBoy.city = city;

    await deliveryBoy.save();

    return res.status(200).json({
      message: 'Delivery Boy details updated successfully',
      success: true,
      data: deliveryBoy
    });

  } catch (error) {
    console.error('Update Delivery Boy Error:', error);
    return res.status(500).json({
      message: 'Failed to update delivery boy details',
      success: false,
      error: error.message
    });
  }
};
// Register Delivery Boy
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
// Delete delivery boy by ID (route: DELETE /delete/:id)
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