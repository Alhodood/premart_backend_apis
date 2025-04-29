const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const  DeliveryBoy  = require('../models/DeliveryBoy');
const Order = require('../models/Order');
const { Shop } = require('../models/Shop');

function calculateDistance(lat1, lon1, lat2, lon2) {
  const toRad = x => x * Math.PI / 180;

  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon/2)**2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // distance in km
}

exports.registerDeliveryBoy = async (req, res) => {
  try {
    const { name, email, phone, password, countryCode, dob, latitude, longitude,agencyId } = req.body;

    if (!name || !email || !phone || !password || !countryCode) {
      return res.status(400).json({
        message: 'Required fields missing',
        success: false,
        data: []
      });
    }

    const existingUser = await DeliveryBoy.findOne({ $or: [{ email }, { phone }] });
    if (existingUser) {
      return res.status(400).json({
        message: 'Email or Phone already registered',
        success: false,
        data: []
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newDeliveryBoy = new DeliveryBoy({
      name,
      email,
      phone,
      password: hashedPassword,
      countryCode,
      dob,
      latitude,
      longitude,
      agencyId
    });

    await newDeliveryBoy.save();

    return res.status(201).json({
      message: 'Delivery Boy registered successfully',
      success: true,
      data: newDeliveryBoy
    });

  } catch (error) {
    console.error('Register Delivery Boy Error:', error);
    res.status(500).json({
      message: 'Failed to register delivery boy',
      success: false,
      data: error.message
    });
  }
};


exports.loginDeliveryBoy = async (req, res) => {
    try {
      const { email, password } = req.body;
  
      if (!email || !password) {
        return res.status(400).json({
          message: 'Email and Password are required',
          success: false,
          data: []
        });
      }
  
      const deliveryBoy = await DeliveryBoy.findOne({ email });
      if (!deliveryBoy) {
        return res.status(404).json({
          message: 'Delivery Boy not found',
          success: false,
          data: []
        });
      }
  
      const isPasswordValid = await bcrypt.compare(password, deliveryBoy.password);
      if (!isPasswordValid) {
        return res.status(401).json({
          message: 'Invalid credentials',
          success: false,
          data: []
        });
      }
  
      const token = jwt.sign(
        { id: deliveryBoy._id, role: deliveryBoy.role },
        process.env.JWT_SECRET || 'your-secret-key', 
        { expiresIn: '7d' }
      );
  
      return res.status(200).json({
        message: 'Login successful',
        success: true,
        token,
        data: deliveryBoy
      });
  
    } catch (error) {
      console.error('Login Delivery Boy Error:', error);
      res.status(500).json({
        message: 'Failed to login',
        success: false,
        data: error.message
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
      const {
        search,
        agencyId,
        availability,
        page = 1,
        limit = 10,
        sort = 'desc',
        sortBy = 'createdAt'
      } = req.query;
  
      let filter = { role: 'deliveryBoy' };
  
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } }
        ];
      }
  
      if (agencyId) {
        filter.agencyId = agencyId;
      }
  
      if (availability === 'true' || availability === 'false') {
        filter.availability = availability === 'true';
      }
  
      const deliveryBoys = await DeliveryBoy.find(filter)
        .sort({ [sortBy]: sort === 'asc' ? 1 : -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit));
  
      const total = await DeliveryBoy.countDocuments(filter);
  
      return res.status(200).json({
        message: 'Delivery boys fetched successfully',
        success: true,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
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




  const mongoose = require('mongoose');

  exports.viewAssignedOrders = async (req, res) => {
    try {
      const deliveryBoyId = req.params.deliveryBoyId;
  
      const assignedOrders = await Order.find({
        assignedDeliveryBoy: new mongoose.Types.ObjectId(deliveryBoyId),
        orderStatus: { $in: ["Delivery Boy Assigned", "Accepted by Delivery Boy", "Picked Up"] }
      }).sort({ createdAt: -1 });
  
      return res.status(200).json({
        message: 'Assigned orders fetched successfully',
        success: true,
        data: assignedOrders
      });
  
    } catch (error) {
      console.error('View Assigned Orders Error:', error);
      res.status(500).json({
        message: 'Failed to fetch assigned orders',
        success: false,
        data: error.message
      });
    }
  };


  exports.deliveryBoyAcceptOrReject = async (req, res) => {
    try {
      const orderId = req.params.orderId;
      const { action } = req.body; // "accept" or "reject"
  
      if (!orderId || !action) {
        return res.status(400).json({
          message: 'OrderId and action are required',
          success: false,
          data: []
        });
      }
  
      let updateData = {};
  
      if (action === "accept") {
        updateData.orderStatus = "Accepted by Delivery Boy";
      } else if (action === "reject") {
        updateData = {
          assignedDeliveryBoy: null,
          orderStatus: "Pending for Delivery Assignment"
        };
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
      const { newStatus } = req.body; // "Picked Up", "Out for Delivery", "Delivered"
  
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


exports.getNearbyDeliveryBoysForShop = async (req, res) => {
  try {
    const { shopId } = req.params;

    const shop = await Shop.findById(shopId);
    if (!shop || !shop.shopeDetails.shopLocation) {
      return res.status(404).json({
        message: 'Shop or location not found',
        success: false
      });
    }

    const [shopLat, shopLng] = shop.shopeDetails.shopLocation.split(',').map(Number);

    const allBoys = await DeliveryBoy.find({}, {
      name: 1,
      phone: 1,
      latitude: 1,
      longitude: 1,
      availability: 1
    });

    const nearbyBoys = allBoys.filter(boy => {
      if (boy.latitude && boy.longitude) {
        const distance = calculateDistance(shopLat, shopLng, boy.latitude, boy.longitude);
        return distance <= 10;
      }
      return false;
    });

    res.status(200).json({
      message: 'Nearby delivery boys within 10km',
      success: true,
      data: nearbyBoys
    });

  } catch (error) {
    res.status(500).json({
      message: 'Failed to fetch nearby delivery boys',
      success: false,
      data: error.message
    });
  }
};


