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

      // 🧮 Distance calculations
      const pickupDistanceKm = geolib.getDistance(
        { latitude: boyLat, longitude: boyLng },
        { latitude: shopLat, longitude: shopLng }
      ) / 1000;

      const dropDistanceKm = geolib.getDistance(
        { latitude: shopLat, longitude: shopLng },
        { latitude: customerLat, longitude: customerLng }
      ) / 1000;

      // 🕒 ETA using Google Distance Matrix API
      const timeUrl = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${boyLat},${boyLng}&destinations=${shopLat},${shopLng}&key=${GOOGLE_MAPS_API_KEY}`;
      const timeResponse = await axios.get(timeUrl);
      const pickupTime = timeResponse.data?.rows?.[0]?.elements?.[0]?.duration?.text || 'N/A';

      // 🕒 Estimate drop time using Google Maps API
      const dropTimeUrl = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${shopLat},${shopLng}&destinations=${customerLat},${customerLng}&key=${GOOGLE_MAPS_API_KEY}`;
      const dropTimeResponse = await axios.get(dropTimeUrl);
      const dropTime = dropTimeResponse.data?.rows?.[0]?.elements?.[0]?.duration?.text || 'N/A';

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

// Get nearby pending orders for delivery boy (within 10km, orderStatus='Pending for Delivery Assignment')
exports.getNearbyPendingOrders = async (req, res) => {
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
    const RANGE_KM = 10;

    // 2. Fetch orders within 10km radius and status 'Pending for Delivery Assignment'
    const pendingOrders = await Order.find({ orderStatus: 'Pending for Delivery Assignment' });

    const nearbyOrders = [];

    for (const order of pendingOrders) {
      const shop = await Shop.findById(order.shopId);
      const shopLocation = shop?.shopeDetails?.shopLocation;
      if (!shopLocation) continue;

      const [shopLat, shopLng] = shopLocation.split(',').map(Number);

      const distanceKm = geolib.getDistance(
        { latitude: boyLat, longitude: boyLng },
        { latitude: shopLat, longitude: shopLng }
      ) / 1000;

      if (distanceKm > RANGE_KM) continue;

      // Optional: calculate ETA
      const timeUrl = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${boyLat},${boyLng}&destinations=${shopLat},${shopLng}&key=${GOOGLE_MAPS_API_KEY}`;
      const timeResponse = await axios.get(timeUrl);
      const pickupTime = timeResponse.data?.rows?.[0]?.elements?.[0]?.duration?.text || 'N/A';

      nearbyOrders.push({
        orderId: order._id,
        shopDetails: shop,
        distanceFromDeliveryBoy: `${distanceKm.toFixed(2)} km`,
        pickupTime
      });
    }

    return res.status(200).json({
      message: 'Nearby pending orders fetched successfully',
      success: true,
      data: nearbyOrders
    });

  } catch (error) {
    console.error('Get Nearby Pending Orders Error:', error);
    return res.status(500).json({
      message: 'Failed to fetch nearby pending orders',
      success: false,
      data: error.message
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
  
      let updateData = {};
  
      if (action === "accept") {
        updateData.orderStatus = "Accepted by Delivery Boy";

        // ✅ Set assignedDeliveryBoy in case it was reset
        updateData.assignedDeliveryBoy = deliveryBoyId;
      
        await DeliveryBoy.findByIdAndUpdate(
          deliveryBoyId,
          { $addToSet: { assignedOrders: orderId } },
          { new: true }
        );
  
      } else if (action === "reject") {
        updateData = {
          assignedDeliveryBoy: null,
          orderStatus: "Pending for Delivery Assignment"
        };
  
        // 🧼 Remove from delivery boy's assignedOrders if rejected
        await DeliveryBoy.findByIdAndUpdate(
          deliveryBoyId,
          { $pull: { assignedOrders: orderId } },
          { new: true }
        );
      } else {
        return res.status(400).json({
          message: 'Invalid action, must be accept or reject',
          success: false,
          data: []
        });
      }
  
      const updatedOrder = await Order.findByIdAndUpdate(orderId, updateData, { new: true });
  
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

    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      {
        orderStatus: newStatus,
        $push: { orderStatusList: { status: newStatus, date: new Date() } }
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

    const deliveryBoy = await DeliveryBoy.findById(deliveryBoyId);
    if (!deliveryBoy || deliveryBoy.role !== 'deliveryBoy') {
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
    const deliveryBoyId = req.params.deliveryBoyId;

    // 1️⃣ Get delivery boy location
    const deliveryBoy = await DeliveryBoy.findById(deliveryBoyId);
    if (!deliveryBoy || !deliveryBoy.latitude || !deliveryBoy.longitude) {
      return res.status(400).json({
        success: false,
        message: "Delivery boy location not found"
      });
    }

    const { latitude: lat1, longitude: lon1 } = deliveryBoy;

    // 2️⃣ Get ALL delivered orders with valid lat/lng
    const orders = await Order.find({
      orderStatus: 'Delivered',
      'deliveryAddress.latitude': { $ne: null },
      'deliveryAddress.longitude': { $ne: null }
    });

    if (orders.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No delivered orders found in system",
        data: []
      });
    }

    // 3️⃣ Build delivery zone frequency map within 10km
    const locationMap = {};

    for (const order of orders) {
      const d = order.deliveryAddress;
      const { flatNumber, area, place, latitude, longitude } = d;
      if (!latitude || !longitude) continue;

      const distance = getDistanceInKm(lat1, lon1, latitude, longitude);
      if (distance > 10) continue;

      const key = `${flatNumber}|${area}|${place}|${latitude}|${longitude}`;
      if (!locationMap[key]) {
        locationMap[key] = {
          flatNumber, area, place, latitude, longitude,
          totalOrders: 1
        };
      } else {
        locationMap[key].totalOrders += 1;
      }
    }

    // 4️⃣ Sort and format top 6
    const ranked = Object.values(locationMap)
      .sort((a, b) => b.totalOrders - a.totalOrders)
      .slice(0, 6)
      .map((loc, index) => ({
        rank: index + 1,
        fullAddress: `${loc.flatNumber}, ${loc.area}, ${loc.place}`,
        latitude: loc.latitude,
        longitude: loc.longitude,
        totalOrders: loc.totalOrders
      }));

    res.status(200).json({
      message: 'Top nearby high-order areas (within 10km)',
      success: true,
      data: ranked
    });

  } catch (error) {
    console.error('Nearby Order Area Error:', error);
    res.status(500).json({
      message: 'Failed to fetch top delivery areas',
      success: false,
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