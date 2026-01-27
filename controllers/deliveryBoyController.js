

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


// Calculate distance between 2 geo points (Haversine)


const twilio = require('twilio');
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTHTOKEN);

const DEV_BYPASS_OTP = true;
const BYPASS_CODE = "123456";

// @deprecated — delivery boy auth now handled by unified authController

// exports.sendOtpToDeliveryBoy = async (req, res) => {
//   const { phone } = req.body;

//   if (!phone) {
//     return res.status(400).json({
//       message: 'Phone is required',
//       success: false
//     });
//   }

//   try {
//     await client.verify.v2.services(process.env.TWILIO_SERVICE_SID)
//       .verifications
//       .create({ to: phone, channel: 'sms' });

//     return res.status(200).json({
//       message: 'OTP sent successfully',
//       success: true
//     });
//   } catch (err) {
//     console.error('Send OTP Error:', err);
//     res.status(500).json({
//       message: 'Failed to send OTP',
//       success: false,
//       error: err.message
//     });
//   }
// };

// exports.sendOtpToDeliveryBoy = async (req, res) => {
//   const { phone } = req.body;

//   if (!phone) {
//     return res.status(400).json({
//       message: 'Phone is required',
//       success: false
//     });
//   }

//   // ✅ DEV MODE: Don't call Twilio
//   if (DEV_BYPASS_OTP) {
//     console.log(`⚠️ DEV MODE OTP bypass active for ${phone} → use 123456`);
//     return res.status(200).json({
//       message: 'OTP sent successfully (DEV MODE)',
//       success: true
//     });
//   }

//   try {
//     await client.verify.v2.services(process.env.TWILIO_SERVICE_SID)
//       .verifications
//       .create({ to: phone, channel: 'sms' });

//     return res.status(200).json({
//       message: 'OTP sent successfully',
//       success: true
//     });
//   } catch (err) {
//     console.error('Send OTP Error:', err);
//     res.status(500).json({
//       message: 'Failed to send OTP',
//       success: false,
//       error: err.message
//     });
//   }
// };

// // Resend OTP to delivery boy
// exports.resendOtpToDeliveryBoy = async (req, res) => {
//   const { phone } = req.body;

//   if (!phone) {
//     return res.status(400).json({
//       message: 'Phone is required',
//       success: false
//     });
//   }

//   try {
//     // Re-trigger OTP sending using Twilio
//     await client.verify.v2.services(process.env.TWILIO_SERVICE_SID)
//       .verifications
//       .create({ to: phone, channel: 'sms' });

//     return res.status(200).json({
//       message: 'OTP resent successfully',
//       success: true
//     });
//   } catch (err) {
//     console.error('Resend OTP Error:', err);
//     res.status(500).json({
//       message: 'Failed to resend OTP',
//       success: false,
//       error: err.message
//     });
//   }
// };

// exports.verifyOtpForDeliveryBoy = async (req, res) => {
//   const { phone, code, countryCode, latitude, longitude, agencyId } = req.body;

//   if (!phone || !code) {
//     return res.status(400).json({
//       message: 'Phone and OTP code are required',
//       success: false
//     });
//   }

//   try {
//     let isVerified = false;

//     // ✅ DEV BYPASS OTP
//     if (code === "123456") {
//       console.log("⚠️ OTP bypass used for:", phone);
//       isVerified = true;
//     } else {
//       // Real Twilio verification
//       const verification = await client.verify.v2
//         .services(process.env.TWILIO_SERVICE_SID)
//         .verificationChecks
//         .create({ to: phone, code });

//       isVerified = verification.status === 'approved';
//     }

//     if (!isVerified) {
//       return res.status(401).json({
//         message: 'Invalid OTP',
//         success: false
//       });
//     }

//     // ===============================
//     // Existing logic stays unchanged
//     // ===============================

//     if (agencyId) {
//       if (!mongoose.Types.ObjectId.isValid(agencyId)) {
//         return res.status(400).json({
//           message: 'Invalid agencyId',
//           success: false
//         });
//       }
//     }

//     let deliveryBoy = await DeliveryBoy.findOne({ phone });

//     if (!deliveryBoy) {
//       if (!countryCode || latitude === undefined || longitude === undefined) {
//         return res.status(400).json({
//           message: 'Missing details for registration (countryCode, latitude, longitude)',
//           success: false
//         });
//       }

//       const createDoc = {
//         phone,
//         countryCode,
//         latitude,
//         longitude,
//         isOnline: false,
//         role: 'deliveryBoy'
//       };

//       if (agencyId) {
//         createDoc.agencyId = agencyId;
//       }

//       deliveryBoy = new DeliveryBoy(createDoc);
//       await deliveryBoy.save();
//     } else {
//       if (agencyId && String(deliveryBoy.agencyId) !== String(agencyId)) {
//         deliveryBoy.agencyId = agencyId;
//         await deliveryBoy.save();
//       }
//     }

//     return res.status(200).json({
//       message: 'OTP verified successfully',
//       success: true,
//       data: deliveryBoy
//     });

//   } catch (err) {
//     console.error('Verify OTP Error:', err);
//     res.status(500).json({
//       message: 'OTP verification failed',
//       success: false,
//       error: err.message
//     });
//   }
// };

// exports.verifyOtpForDeliveryBoy = async (req, res) => {
//   const { phone, code, countryCode, latitude, longitude, agencyId } = req.body;

//   if (!phone || !code) {
//     return res.status(400).json({
//       message: 'Phone and OTP code are required',
//       success: false
//     });
//   }

//   try {
//     const verification = await client.verify.v2.services(process.env.TWILIO_SERVICE_SID)
//       .verificationChecks
//       .create({ to: phone, code });

//     if (verification.status === 'approved') {
//       // If agencyId is sent, validate its format and (optionally) existence
//       if (agencyId) {
//         if (!mongoose.Types.ObjectId.isValid(agencyId)) {
//           return res.status(400).json({
//             message: 'Invalid agencyId',
//             success: false
//           });
//         }
//         // Optional existence check (uncomment if you want to enforce it strictly)
//         // const agencyExists = await DeliveryAgency.findById(agencyId).lean();
//         // if (!agencyExists) {
//         //   return res.status(404).json({ message: 'Agency not found', success: false });
//         // }
//       }

//       let deliveryBoy = await DeliveryBoy.findOne({ phone });

//       // If not found, register new delivery boy with required details from req.body
//       if (!deliveryBoy) {
//         if (!countryCode || latitude === undefined || longitude === undefined) {
//           return res.status(400).json({
//             message: 'Missing details for registration (countryCode, latitude, longitude)',
//             success: false
//           });
//         }

//         const createDoc = {
//           phone,
//           countryCode,
//           latitude,
//           longitude,
//           isOnline: false,
//           role: 'deliveryBoy'
//         };
//         if (agencyId) {
//           createDoc.agencyId = agencyId;
//         }

//         deliveryBoy = new DeliveryBoy(createDoc);
//         await deliveryBoy.save();
//       } else {
//         // If delivery boy already exists and a (possibly new) agencyId is provided, update it
//         if (agencyId && String(deliveryBoy.agencyId) !== String(agencyId)) {
//           deliveryBoy.agencyId = agencyId;
//           await deliveryBoy.save();
//         }
//       }

//       return res.status(200).json({
//         message: 'OTP verified successfully',
//         success: true,
//         data: deliveryBoy
//       });
//     } else {
//       return res.status(401).json({
//         message: 'Invalid OTP',
//         success: false
//       });
//     }
//   } catch (err) {
//     console.error('Verify OTP Error:', err);
//     res.status(500).json({
//       message: 'OTP verification failed',
//       success: false,
//       error: err.message
//     });
//   }
// };


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

  exports.getDeliveryBoyById = async (req, res) => {
  try {
    const { deliveryBoyId } = req.params;

    const deliveryBoy = await DeliveryBoy.findById(deliveryBoyId);

    if (!deliveryBoy) {
      return res.status(404).json({
        success: false,
        message: "Delivery boy not found",
        data: null,
      });
    }

    res.status(200).json({
      success: true,
      message: "Delivery boy fetched successfully",
      data: deliveryBoy,
    });

  } catch (error) {
    console.error("Get delivery boy error:", error);
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

    // ✅ 3. Fetch assigned orders (use 'status' not 'orderStatus')
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
      status: { $in: allowedStatuses }  // ✅ Changed from orderStatus
    }).sort({ createdAt: -1 });

    console.log(`📦 Found assigned orders:`, assignedOrders.length);

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

    // ✅ Changed orderStatus to status
    const assignedOrders = await Order.find({ 
      status: 'Delivery Boy Assigned' 
    }).populate('deliveryAddress');

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

      let pickupTime = "N/A";
      try {
        const pickupUrl = encodeURI(
          `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${boyLat},${boyLng}&destinations=${shopLat},${shopLng}&key=${GOOGLE_MAPS_API_KEY}`
        );
        const pickupResponse = await axios.get(pickupUrl);
        const pickupElement = pickupResponse.data?.rows?.[0]?.elements?.[0];
        pickupTime = pickupElement?.status === 'OK' && pickupElement?.duration
          ? pickupElement.duration.text
          : 'N/A';
      } catch (err) {
        pickupTime = "N/A";
      }

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
          const dropUrl = encodeURI(
            `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${shopLat},${shopLng}&destinations=${customerLat},${customerLng}&key=${GOOGLE_MAPS_API_KEY}`
          );
          const dropResponse = await axios.get(dropUrl);
          const dropElement = dropResponse.data?.rows?.[0]?.elements?.[0];
          dropTime = dropElement?.status === 'OK' && dropElement?.duration
            ? dropElement.duration.text
            : 'N/A';
        } catch (err) {
          dropTime = "N/A";
        }
      }

      const shopDetails = {
        shopName: shop?.shopeDetails?.shopName || '',
        shopAddress: shop?.shopeDetails?.shopAddress || '',
        shopContact: shop?.shopeDetails?.shopContact || '',
      };

      const deliveryDetails = {
        deliveryBoyId: order.assignedDeliveryBoy || null,
        orderStatus: order.status,  // ✅ Using 'status' field
        pickupDistance: `${pickupDistance.toFixed(2)}`,
        pickupTime,
        dropDistance: `${dropDistance ? dropDistance.toFixed(2) : '0.00'}`,
        dropTime,
        deliveryEarnings: order.deliveryEarning || 0,
      };

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

// ============================================
// FIX: Get Ongoing Orders - Populate Shop Details
// ============================================

exports.getOngoingOrdersForDeliveryBoy = async (req, res) => {
  try {
    const { deliveryBoyId } = req.params;

    if (!deliveryBoyId) {
      return res.status(400).json({
        success: false,
        message: 'Delivery Boy ID is required'
      });
    }

    console.log(`🔍 Fetching ongoing orders for delivery boy: ${deliveryBoyId}`);

    // ✅ Find ongoing orders for this delivery boy
    const ongoingOrders = await Order.find({
      assignedDeliveryBoy: deliveryBoyId,
      status: { $nin: ['Delivered', 'Cancelled'] }
    }).sort({ updatedAt: -1 });

    console.log(`📦 Found ${ongoingOrders.length} ongoing orders`);

    // ✅ Populate shop details for each order
    const ordersWithDetails = await Promise.all(
      ongoingOrders.map(async (order) => {
        const shop = await Shop.findById(order.shopId);
        
        // Get delivery boy location for distance calculation
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
            // Calculate pickup distance (delivery boy to shop)
            const pickupDist = geolib.getDistance(
              { latitude: boyLat, longitude: boyLng },
              { latitude: shopLat, longitude: shopLng }
            ) / 1000;

            pickupDistance = `${pickupDist.toFixed(2)} km`;
            pickupTime = `${Math.ceil((pickupDist / 30) * 60)} mins`;

            // Calculate drop distance (shop to customer)
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
            shopName: shop.shopeDetails?.shopName || 'Unknown Shop',
            shopAddress: shop.shopeDetails?.shopAddress || '',
            shopContact: shop.shopeDetails?.shopContact || '',
            shopLocation: shop.shopeDetails?.shopLocation || ''
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
    console.error('❌ Get Ongoing Orders Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching ongoing orders',
      error: err.message
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


  // Find this function in your file and replace it completely

exports.deliveryBoyAcceptOrReject = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const { action, deliveryBoyId } = req.body;

    console.log(`📦 Delivery boy ${deliveryBoyId} attempting to ${action} order ${orderId}`);

    // ========================
    // 1. VALIDATE INPUTS
    // ========================
    if (!orderId || !action || !deliveryBoyId) {
      return res.status(400).json({
        message: 'OrderId, action and deliveryBoyId are required',
        success: false,
        data: []
      });
    }

    // ========================
    // 2. VALIDATE DELIVERY BOY
    // ========================
    const deliveryBoy = await DeliveryBoy.findById(deliveryBoyId);
    if (!deliveryBoy) {
      return res.status(404).json({
        message: 'Delivery Boy not found',
        success: false,
        data: []
      });
    }

    // ========================
    // 3. VALIDATE ORDER
    // ========================
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        message: 'Order not found',
        success: false,
        data: []
      });
    }

    // ========================
    // 4. PROCESS ACTION
    // ========================
    if (action === "accept") {
      // Check if already assigned to another delivery boy
      if (order.assignedDeliveryBoy && 
          order.assignedDeliveryBoy.toString() !== deliveryBoyId.toString()) {
        return res.status(409).json({
          message: 'Order already accepted by another delivery boy',
          success: false,
          data: {
            assignedTo: order.assignedDeliveryBoy
          }
        });
      }

      // ✅ ACCEPT ORDER
      order.status = "Accepted by Delivery Boy";
      order.assignedDeliveryBoy = deliveryBoyId;
      
      // ✅ Add to status history
      if (!Array.isArray(order.statusHistory)) {
        order.statusHistory = [];
      }
      order.statusHistory.push({ 
        status: 'Accepted by Delivery Boy', 
        date: new Date() 
      });
      
      await order.save();

      // ✅ Update delivery boy's assignedOrders
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

      console.log(`✅ Order ${orderId} accepted by delivery boy ${deliveryBoyId}`);
      console.log(`💰 Order earning: ${order.deliveryEarning} AED`);
      console.log(`📍 Delivery distance: ${order.deliveryDistance} km`);

      // ✅ Emit Socket.IO event
      try {
        const io = getIO();
        
        // Notify shop
        io.emit('order_accepted', {
          orderId: order._id,
          deliveryBoyId: deliveryBoy._id,
          deliveryBoyName: deliveryBoy.name,
          shopId: order.shopId,
          status: order.status
        });

        // Notify delivery boy
        io.to(deliveryBoyId.toString()).emit('order_accepted_confirmation', {
          orderId: order._id,
          message: 'Order accepted successfully',
          deliveryEarning: order.deliveryEarning
        });
      } catch (socketErr) {
        console.warn('Socket.IO emit failed:', socketErr.message);
      }

      // ✅ FIX: Return complete order data with all fields
      return res.status(200).json({
        message: 'Order accepted successfully',
        success: true,
        data: {
          orderId: order._id,
          status: order.status,
          deliveryDistance: order.deliveryDistance,      // ✅ Include this
          deliveryEarning: order.deliveryEarning,        // ✅ Include this
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
      // ✅ REJECT ORDER
      order.assignedDeliveryBoy = null;
      order.status = "Pending for Delivery Assignment";
      
      // ✅ Add to status history
      if (!Array.isArray(order.statusHistory)) {
        order.statusHistory = [];
      }
      order.statusHistory.push({
        status: 'Rejected by Delivery Boy',
        date: new Date()
      });
      
      await order.save();

      // ✅ Remove from delivery boy's assignedOrders
      if (Array.isArray(deliveryBoy.assignedOrders) && deliveryBoy.assignedOrders.length > 0) {
        const orderIdStr = orderId.toString();
        deliveryBoy.assignedOrders = deliveryBoy.assignedOrders.filter(
          id => id.toString() !== orderIdStr
        );
        await deliveryBoy.save();
      }

      console.log(`❌ Order ${orderId} rejected by delivery boy ${deliveryBoyId}`);

      // ✅ Emit Socket.IO event
      try {
        const io = getIO();
        
        // Notify shop that order needs reassignment
        io.emit('order_rejected', {
          orderId: order._id,
          deliveryBoyId: deliveryBoy._id,
          shopId: order.shopId,
          status: order.status
        });
      } catch (socketErr) {
        console.warn('Socket.IO emit failed:', socketErr.message);
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
    console.error('❌ DeliveryBoy Accept/Reject Error:', error);
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

    // Fetch order
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
    
    await updatedOrder.save();

    // ========================
    // DEFINE currentMonth BEFORE USE
    // ========================
    const currentMonth = new Date().toLocaleString('default', { 
      month: 'long', 
      year: 'numeric' 
    });

    // ========================
    // DELIVERED STATUS HANDLING
    // ========================
    if (updatedOrder.status === 'Delivered') {
      console.log('📦 Order delivered, processing payments...');

      // ========================
      // 1. AGENCY PAYMENT (NEW COLLECTION)
      // ========================
      const orderEarning = Number(updatedOrder.deliveryEarning || 0);
      console.log(`💰 Delivery earning for agency: ${orderEarning} AED`);

      const deliveryBoy = await DeliveryBoy.findById(updatedOrder.assignedDeliveryBoy).lean();

      if (deliveryBoy && deliveryBoy.agencyId) {
        const AgencyPayout = require('../models/AgencyPayout');
        
        // Get start and end of current month
        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);

        // Check if payout for this month exists
        let agencyPayout = await AgencyPayout.findOne({
          agencyId: deliveryBoy.agencyId,
          from: startOfMonth,
          to: endOfMonth
        });

        if (agencyPayout) {
          // Update existing payout
          agencyPayout.totalOrders += 1;
          agencyPayout.totalEarnings += orderEarning;
          await agencyPayout.save();
          console.log(`✅ Updated existing agency payout: ${agencyPayout.totalEarnings} AED`);
        } else {
          // Create new payout record
          agencyPayout = await AgencyPayout.create({
            agencyId: deliveryBoy.agencyId,
            deliveryBoyId: deliveryBoy._id,
            orderId: updatedOrder._id,
            totalOrders: 1,
            totalEarnings: orderEarning,
            from: startOfMonth,
            to: endOfMonth,
            month: currentMonth,
            status: 'Pending',
            transactionId: `AGY-${Date.now()}`
          });
          console.log(`✅ Created new agency payout record`);
        }
      }

      // ========================
      // 2. SHOP/VENDOR PAYMENT
      // ========================
      const shopId = updatedOrder.shopId;
      const orderAmount = Number(updatedOrder.totalPayable || 0);
      const PLATFORM_COMMISSION_PERCENT = 5; // 5% commission
      
      const commission = (orderAmount * PLATFORM_COMMISSION_PERCENT) / 100;
      const netPayable = orderAmount - commission;

      console.log(`🏪 Shop payment: Total=${orderAmount}, Commission=${commission}, Net=${netPayable}`);

      // Check if shop payout for this month exists
      const ShopPayout = require('../models/ShopPayout');
      
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);

      let shopPayout = await ShopPayout.findOne({
        shopId,
        from: startOfMonth,
        to: endOfMonth
      });

      if (shopPayout) {
        // Update existing payout
        shopPayout.totalOrders += 1;
        shopPayout.totalSales += orderAmount;
        shopPayout.platformCommission += commission;
        shopPayout.netPayable += netPayable;
        await shopPayout.save();
        console.log(`✅ Updated existing shop payout`);
      } else {
        // Create new payout record
        shopPayout = await ShopPayout.create({
          shopId,
          totalOrders: 1,
          totalSales: orderAmount,
          platformCommission: commission,
          netPayable,
          from: startOfMonth,
          to: endOfMonth,
          status: 'Pending',
          transactionId: `SHOP-${Date.now()}`
        });
        console.log(`✅ Created new shop payout record`);
      }
    }

    // ========================
    // Socket.IO Notification
    // ========================
    try {
      const io = getIO();
      io.emit('order_status_changed', {
        orderId: updatedOrder._id,
        status: updatedOrder.status,
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
  if (!deliveryBoy || deliveryBoy.role !== 'DELIVERY_BOY') {
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
    const orders = await Order.find({
      status: "Delivered",  // ✅ Changed from orderStatus
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
    console.error("Nearby Top Areas Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch nearby top order areas",
      error: error.message
    });
  }
};


// ============================================
// ENHANCED EARNINGS API WITH STATISTICS
// ============================================

exports.getDeliveryEarningsHistory = async (req, res) => {
  try {
    const deliveryBoyId = req.params.deliveryBoyId;

    // ✅ Get all delivered orders
    const deliveredOrders = await Order.find({
      assignedDeliveryBoy: deliveryBoyId,
      status: 'Delivered'
    }).sort({ updatedAt: -1 });

    // ✅ Calculate statistics
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

    // ✅ Group orders by date
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

    // ✅ Response with statistics
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
    console.error('❌ Earning History Error:', error);
    res.status(500).json({
      message: 'Failed to fetch earnings',
      success: false,
      error: error.message
    });
  }
};


// ============================================
// ENHANCED HISTORY API WITH RICH ORDER DATA
// ============================================

exports.getDeliveryOrderHistory = async (req, res) => {
  try {
    const deliveryBoyId = req.params.deliveryBoyId;

    // 1. Validate delivery boy
    const deliveryBoy = await DeliveryBoy.findById(deliveryBoyId);
    if (!deliveryBoy) {
      return res.status(404).json({
        message: 'Delivery boy not found',
        success: false,
        data: []
      });
    }

    // 2. Fetch all orders assigned to this delivery boy
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

    // 3. Calculate statistics
    const statistics = {
      totalOrders: orders.length,
      delivered: orders.filter(o => o.status === 'Delivered').length,
      cancelled: orders.filter(o => o.status === 'Cancelled').length,
      totalEarnings: orders
        .filter(o => o.status === 'Delivered')
        .reduce((sum, o) => sum + (o.deliveryEarning || 0), 0),
      totalDistance: orders
        .reduce((sum, o) => sum + (o.deliveryDistance || 0), 0)
    };

    // 4. Group orders by date with rich data
    const groupedOrders = {};

    for (const order of orders) {
      // Fetch shop details
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

      // Get status badge color
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
        distance: parseFloat((order.deliveryDistance || 0).toFixed(2)),
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
    console.error('❌ Order History Error:', error);
    return res.status(500).json({
      message: 'Failed to fetch delivery order history',
      success: false,
      data: error.message
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