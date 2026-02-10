const jwt = require('jsonwebtoken');
const roleModelMap = require('../constants/roleModelMap');

const { Shop } = require('../models/Shop');
const { ROLES } = require('../constants/roles');
const User = require('../models/User');
const DeliveryBoy = require('../models/DeliveryBoy');
const crypto = require('crypto');

// ✅ FIX: Import ShopAdmin from Admin.js, NOT Shop.js
const { ShopAdmin, SuperAdmin } = require('../models/AdminAuth');


const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRE = '7d';

const generateToken = (payload) =>
  jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRE });

// controllers/rbacAuthController.js

exports.register = async (req, res) => {
  try {
    const { 
      name, 
      email, 
      dob, 
      phone, 
      password, 
      countryCode, 
      role, 
      latitude,
      longitude,
      agencyId,
      // ✅ ADD ALL MISSING FIELDS
      emiratesId,
      areaAssigned,
      licenseNo,
      city,
      profileImage,
      licenseImage,
    } = req.body;

    console.log('📦 Registration payload:', req.body);

    // Validate required fields
    if (!phone || !password || !countryCode) {
      return res.status(400).json({
        success: false,
        message: 'Phone, password, and country code are required'
      });
    }

    // ✅ Validate location for DELIVERY_BOY
    if (role === ROLES.DELIVERY_BOY) {
      if (latitude === undefined || longitude === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Latitude and longitude are required for delivery boy registration'
        });
      }

      // Validate coordinate format
      if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        return res.status(400).json({
          success: false,
          message: 'Latitude and longitude must be numbers'
        });
      }

      // Validate agencyId if provided
      if (agencyId) {
        const { DeliveryAgency } = require('../models/DeliveryAgency');
        const agencyExists = await DeliveryAgency.findById(agencyId);
        if (!agencyExists) {
          return res.status(404).json({
            success: false,
            message: 'Invalid agency ID'
          });
        }
      }
    }

    let existingUser;
    if (role === ROLES.CUSTOMER) {
      existingUser = await User.findOne({ phone });
    } else if (role === ROLES.DELIVERY_BOY) {
      existingUser = await DeliveryBoy.findOne({ phone });
    } else if (role === ROLES.SHOP_ADMIN) {
      existingUser = await ShopAdmin.findOne({ phone });
    }

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this phone number already exists'
      });
    }

    // Create user based on role
    let newUser;

    if (role === ROLES.CUSTOMER) {
      newUser = await User.create({
        name,
        email,
        phone,
        password,
        countryCode,
        role: ROLES.CUSTOMER
      });
    } else if (role === ROLES.DELIVERY_BOY) {
      // ✅ CREATE WITH ALL FIELDS
      newUser = await DeliveryBoy.create({
        name: name || 'New Delivery Boy',
        email,
        phone,
        password,
        countryCode,
        dob,
        licenseNo,
        emiratesId,
        profileImage,
        licenseImage,
        areaAssigned,
        city,
        latitude,
        longitude,
        availability: true,
        isOnline: false,
        accountVerify: false,
        assignedOrders: [],
        role: ROLES.DELIVERY_BOY,
        agencyId: agencyId || null
      });

      console.log('✅ Delivery boy created:', newUser._id);
    } else if (role === ROLES.SHOP_ADMIN) {
      newUser = await ShopAdmin.create({
        name,
        email,
        phone,
        password,
        countryCode,
        role: ROLES.SHOP_ADMIN
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid role specified'
      });
    }

    // Generate OTP and send (if you have OTP logic)
    // ... your existing OTP logic

    return res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        userId: newUser._id,
        name: newUser.name,
        phone: newUser.phone,
        email: newUser.email,
        role: newUser.role,
        ...(role === ROLES.DELIVERY_BOY && {
          emiratesId: newUser.emiratesId,
          licenseNo: newUser.licenseNo,
          areaAssigned: newUser.areaAssigned,
          city: newUser.city,
          profileImage: newUser.profileImage,
          licenseImage: newUser.licenseImage,
          location: {
            latitude: newUser.latitude,
            longitude: newUser.longitude
          }
        })
      }
    });
  } catch (err) {
    console.error('❌ Registration Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: err.message
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password, role } = req.body;
    
    if (!role || !roleModelMap[role]) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }

    let user;

    // =======================
    // AGENCY LOGIN (FIXED)
    // =======================
    if (role === ROLES.AGENCY) {
      const { DeliveryAgency } = require('../models/DeliveryAgency');
      user = await DeliveryAgency.findOne({
        'agencyDetails.email': email
      });

      if (!user) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }

      const match = await user.comparePassword(password);
      if (!match) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }

      const token = generateToken({ id: user._id, role });
      return res.json({
        success: true,
        message: 'Login successful',
        data: {
          id: user._id,
          role,
          token,
          agencyId: user._id
        }
      });
    }

    // =======================
    // ALL OTHER ROLES
    // =======================
    const Model = roleModelMap[role];
    
    if (role === ROLES.CUSTOMER) {
      user = await Model.findOne({
        $or: [
          { email: email },
          { phone: email } // allows phone entered in email field
        ]
      });
    } else {
      user = await Model.findOne({ email });
    }

    if (!user || !user.comparePassword) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const match = await user.comparePassword(password);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // ✅ CHECK ACCOUNT VISIBILITY FOR CUSTOMER
    if (role === ROLES.CUSTOMER) {
      if (user.accountVisibility === false) {
        return res.status(403).json({ 
          success: false, 
          message: 'Your account has been deactivated. Please contact Premart admin.',
          accountDeactivated: true // ✅ Flag to help frontend show specific message
        });
      }
    }

    const token = generateToken({ id: user._id, role });

    const response = {
      id: user._id,
      role,
      token,
      user: {
        name: user.name,
        email: user.email,
        phone: user.phone,
        accountVerify: user.accountVerify,
        dob: user.dob,
      }
    };

    if (role === ROLES.SHOP_ADMIN) {
      response.shopId = user.shopId;
    }

    res.json({
      success: true,
      message: 'Login successful',
      data: response
    });
    
  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.sendOtp = async (req, res) => {
  const { phone } = req.body;

  if (!phone) {
    return res.status(400).json({
      success: false,
      message: 'Phone is required'
    });
  }

  return res.status(200).json({
    success: true,
    message: 'OTP sent successfully (bypass enabled)'
  });
};

exports.verifyOtp = async (req, res) => {
  try {
    const { phone, role, countryCode, latitude, longitude, agencyId, code, deviceToken } = req.body;

    if (!deviceToken) {
      return res.status(400).json({
        success: false,
        message: 'Device token is required'
      });
    }

    if (code !== "123456") {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    if (!phone || !role) {
      return res.status(400).json({ success: false, message: 'phone and role are required' });
    }

    if (role !== 'DELIVERY_BOY') {
      return res.status(403).json({ success: false, message: 'Only delivery boy supported' });
    }

    const Model = roleModelMap[role];
    let user = await Model.findOne({ phone });

    if (!user) {
      // New user - create and assign device
      user = await Model.create({
        phone, role, countryCode, latitude, longitude,
        agencyId: agencyId || null,
        isOnline: false,
        availability: true,
        activeDeviceToken: deviceToken,
        lastLoginAt: new Date(),
      });
    } else {
      // ✅ CHECK: Is another device already logged in?
      if (user.activeDeviceToken && user.activeDeviceToken !== deviceToken) {
        return res.status(409).json({
          success: false,
          message: 'Your account is already logged in on another device. Please logout from the other device first.',
          alreadyLoggedIn: true,
          activeDeviceInfo: user.activeDeviceInfo || 'Unknown device',
        });
      }

      // Same device or no active session - update device token
      user.activeDeviceToken = deviceToken;
      user.lastLoginAt = new Date();
      await user.save();
    }

    const token = jwt.sign(
      { id: user._id, role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      success: true,
      message: 'Login success',
      data: { id: user._id, role, token }
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// In your auth controller
exports.logoutDeliveryBoy = async (req, res) => {
  try {
    const { id } = req.user; // from JWT middleware

    await DeliveryBoy.findByIdAndUpdate(id, {
      activeDeviceToken: null,
      activeDeviceInfo: null,
      isOnline: false,
    });

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Optional: Force logout from admin panel
exports.forceLogoutDeliveryBoy = async (req, res) => {
  try {
    const { deliveryBoyId } = req.params;

    await DeliveryBoy.findByIdAndUpdate(deliveryBoyId, {
      activeDeviceToken: null,
      activeDeviceInfo: null,
      isOnline: false,
    });

    return res.status(200).json({
      success: true,
      message: 'Device session cleared'
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.createSuperAdmin = async (req, res) => {
  try {
    const { name, email, password, phone, countryCode } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        message: 'name, email, password are required'
      });
    }

    const Model = roleModelMap[ROLES.SUPER_ADMIN];

    // prevent duplicates
    const exists = await Model.findOne({ email });
    if (exists) {
      return res.status(400).json({
        success: false,
        message: 'Super admin already exists with this email'
      });
    }

    const admin = await Model.create({
      name,
      email,
      password,
      phone,
      countryCode,
      role: ROLES.SUPER_ADMIN
    });

    const token = generateToken({
      id: admin._id,
      role: ROLES.SUPER_ADMIN
    });

    res.status(201).json({
      success: true,
      message: 'Super admin created successfully',
      data: {
        id: admin._id,
        role: ROLES.SUPER_ADMIN,
        token
      }
    });

  } catch (err) {
    console.error('Create SuperAdmin Error:', err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

exports.getAllCustomers = async (req, res) => {
  try {
    const customers = await User.find({ role: ROLES.CUSTOMER })
      .select('-password -__v')
      .sort({ createdAt: -1 });

    const flatData = customers.map(u => ({
      userId: u._id,
      name: u.name || null,
      email: u.email || null,
      phone: u.phone || null,
      accountVerify: u.accountVerify || false,
      accountVisibility: u.accountVisibility || false,
      createdAt: u.createdAt,

      // First address for table
      address: u.address?.[0]?.address || null,
      area: u.address?.[0]?.area || null,
      place: u.address?.[0]?.place || null,
      contact: u.address?.[0]?.contact || null,
    }));

    return res.status(200).json({
      success: true,
      message: 'All customers fetched successfully',
      count: flatData.length,
      data: flatData
    });

  } catch (err) {
    console.error('Get Customers Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch customers',
      data: err.message
    });
  }
};

exports.createShopAdmin = async (req, res) => {
  try {
    console.log('========== CREATE SHOP ADMIN REQUEST ==========');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    const { name, email, password, phone } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      console.log('❌ Missing required fields');
      return res.status(400).json({ 
        success: false, 
        message: 'Name, email, and password are required' 
      });
    }

    const Model = roleModelMap[ROLES.SHOP_ADMIN];
    
    // Check if shop admin already exists
    console.log('🔍 Checking for existing shop admin with email:', email);
    const exists = await Model.findOne({ email });
    
    if (exists) {
      console.log('❌ Shop admin already exists');
      return res.status(400).json({ 
        success: false, 
        message: 'Shop admin with this email already exists' 
      });
    }

    console.log('✅ No duplicate found, creating shop...');

    // STEP 1: Create shop entity
    const shop = await Shop.create({ 
      shopeDetails: { 
        shopName: name, 
        shopMail: email, 
        shopContact: phone || '' 
      } 
    });

    console.log('✅ Shop created successfully');
    console.log('Shop ID:', shop._id.toString());
    console.log('Shop details:', JSON.stringify(shop.shopeDetails, null, 2));

    // STEP 2: Create shop admin linked to shop
    console.log('Creating shop admin...');
    const admin = await Model.create({ 
      name, 
      email, 
      password, 
      phone: phone || '',
      role: ROLES.SHOP_ADMIN, 
      shopId: shop._id 
    });

    console.log('✅ Shop admin created successfully');
    console.log('Admin ID:', admin._id.toString());
    console.log('Admin shopId:', admin.shopId?.toString());

    // ✅ CRITICAL FIX: Return proper response format that Flutter expects
    const response = {
      success: true,
      message: 'Shop admin and shop created successfully',
      data: {
        adminId: admin._id.toString(),
        shopId: shop._id.toString(), // ✅ Ensure it's a string
        email: admin.email,
        name: admin.name,
        phone: admin.phone,
        role: admin.role
      }
    };

    console.log('========== RESPONSE ==========');
    console.log(JSON.stringify(response, null, 2));
    console.log('==============================');

    return res.status(201).json(response);

  } catch (err) {
    console.error('========== CREATE SHOP ADMIN ERROR ==========');
    console.error('Error name:', err.name);
    console.error('Error message:', err.message);
    console.error('Error stack:', err.stack);
    console.error('===========================================');
    
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to create shop admin',
      error: err.message,
      errorDetails: err.toString()
    });
  }
};

exports.createAgency = async (req, res) => {
  try {
    const { agencyDetails } = req.body;

    if (!agencyDetails?.agencyName || !agencyDetails?.agencyMail) {
      return res.status(400).json({ success: false, message: 'Missing agency fields' });
    }

    const Model = roleModelMap[ROLES.AGENCY];

    const exists = await Model.findOne({
      'agencyDetails.email': agencyDetails.email
    });

    if (exists) {
      return res.status(400).json({ success: false, message: 'Agency already exists' });
    }

    const agency = await Model.create({
      agencyDetails: {
        ...agencyDetails,
        role: ROLES.AGENCY,
        email: agencyDetails.email,
        password: agencyDetails.password || 'Temp@123'
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Agency created successfully',
      data: {
        agencyId: agency._id
      }
    });

  } catch (err) {
    console.error('Create Agency Error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// controllers/rbacAuthController.js

exports.getCustomerDetailsById = async (req, res) => {
  try {
    const { userId } = req.params;

    console.log('========== GET CUSTOMER DETAILS ==========');
    console.log('Requested userId:', userId);

    const User = require('../models/User');
    
    // Check if userId is a valid MongoDB ObjectId
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      console.log('Invalid ObjectId format');
      return res.status(400).json({
        success: false,
        message: 'Invalid customer ID format'
      });
    }

    const customer = await User.findById(userId)
      .select('-password -__v')
      .lean();

    if (!customer) {
      console.log('Customer not found');
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    console.log('Customer found:', customer.name || customer.email);
    console.log('Customer data:', JSON.stringify(customer, null, 2));

    return res.status(200).json({
      success: true,
      message: 'Customer details fetched successfully',
      data: customer
    });
  } catch (err) {
    console.error('Get Customer Details Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch customer details',
      error: err.message
    });
  }
};

// controllers/rbacAuthController.js

exports.getCustomerOrders = async (req, res) => {
  try {
    const { userId } = req.params;

    console.log('========== GET CUSTOMER ORDERS ==========');
    console.log('Requested userId:', userId);

    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid customer ID format'
      });
    }

    // Import your Order model (adjust path as needed)
    const Order = require('../models/Order');

    const orders = await Order.find({ userId: userId })
      .sort({ createdAt: -1 })
      .lean();

    console.log(`Found ${orders.length} orders for customer ${userId}`);

    return res.status(200).json({
      success: true,
      message: 'Customer orders fetched successfully',
      count: orders.length,
      data: orders
    });
  } catch (err) {
    console.error('Get Customer Orders Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch customer orders',
      error: err.message
    });
  }
};

// ✅ AGENCY PUBLIC REGISTRATION (for agency owners to self-register)
exports.registerAgency = async (req, res) => {
  try {
    const { email, password, agencyDetails } = req.body;

    console.log('📝 Agency Registration Request:', { email, agencyDetails: !!agencyDetails });

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    if (!agencyDetails?.agencyName || !agencyDetails?.agencyContact) {
      return res.status(400).json({
        success: false,
        message: 'Agency name and contact are required'
      });
    }

    const { DeliveryAgency } = require('../models/DeliveryAgency');

    // Check if agency already exists
    const existingAgency = await DeliveryAgency.findOne({
      'agencyDetails.email': email
    });

    if (existingAgency) {
      return res.status(400).json({
        success: false,
        message: 'Agency with this email already exists'
      });
    }

    // Create agency
    const agency = await DeliveryAgency.create({
      agencyDetails: {
        ...agencyDetails,
        email,
        password,
        role: ROLES.AGENCY
      }
    });

    console.log('✅ Agency created:', agency._id);

    // Generate token
    const token = generateToken({
      id: agency._id,
      role: ROLES.AGENCY
    });

    return res.status(201).json({
      success: true,
      message: 'Agency registered successfully',
      data: {
        agencyId: agency._id,
        role: ROLES.AGENCY,
        token
      }
    });

  } catch (err) {
    console.error('❌ Agency Registration Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Agency registration failed',
      error: err.message
    });
  }
};

// ✅ SHOP ADMIN PUBLIC REGISTRATION (for shop owners to self-register)
exports.registerShopAdmin = async (req, res) => {
  try {
    const { name, email, phone, password, location, emiratesId } = req.body;

    console.log('📝 Shop Registration Request:', { name, email, phone });

    // Validate required fields
    if (!name || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, phone, and password are required'
      });
    }

    // Validate password strength
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // ✅ UNCOMMENT AND FIX THESE IMPORTS
    // You already have ShopAdmin imported at the top of the file from '../models/Shop'
    // So we can use it directly without re-importing
    // But Shop is already imported at the top too

    // Check if shop admin already exists
    const existingAdmin = await ShopAdmin.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Shop admin with this email already exists'
      });
    }

    // 1. Create shop first
    const shop = await Shop.create({
      shopeDetails: {
        shopName: name,
        shopMail: email,
        shopContact: phone,
        shopLocation: location || '25.1372,55.2316',
        EmiratesId: emiratesId || ''
      }
    });

    console.log('✅ Shop created:', shop._id);

    // 2. Create shop admin with user-provided password
    const admin = await ShopAdmin.create({
      name,
      email,
      phone,
      password,
      countryCode: '+971',
      role: ROLES.SHOP_ADMIN,
      shopId: shop._id
    });

    console.log('✅ Shop admin created:', admin._id);

    // Generate token
    const token = generateToken({
      id: admin._id,
      role: ROLES.SHOP_ADMIN
    });

    return res.status(201).json({
      success: true,
      message: 'Shop registered successfully. You can now login with your credentials.',
      data: {
        adminId: admin._id,
        shopId: shop._id,
        role: ROLES.SHOP_ADMIN,
        token
      }
    });

  } catch (err) {
    console.error('❌ Shop Registration Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Shop registration failed',
      error: err.message
    });
  }
};

// Forgot Password - Send Reset Email/OTP
exports.forgotPassword = async (req, res) => {
  try {
    const { email, role } = req.body;

    console.log('========== FORGOT PASSWORD REQUEST ==========');
    console.log('Email:', email);
    console.log('Role:', role);

    // Validate input
    if (!email || !role) {
      return res.status(400).json({
        success: false,
        message: 'Email and role are required'
      });
    }

    // Get the appropriate model based on role
    const roleModelMap = require('../constants/roleModelMap');
    const Model = roleModelMap[role];

    if (!Model) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role specified'
      });
    }

    // Find user by email
    let user;
    if (role === 'AGENCY') {
      const { DeliveryAgency } = require('../models/DeliveryAgency');
      user = await DeliveryAgency.findOne({ 'agencyDetails.email': email });
    } else {
      user = await Model.findOne({ email });
    }

    if (!user) {
      // Don't reveal if user exists or not (security best practice)
      return res.status(200).json({
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent.',
        data: { email }
      });
    }

    // ✅ TESTING: Use fixed OTP "123456" instead of generating random one
    const resetOTP = "123456";
    
    // Set OTP expiry (15 minutes)
    const otpExpiry = new Date(Date.now() + 15 * 60 * 1000);

    // Save OTP to user record
    user.resetPasswordOTP = resetOTP;
    user.resetPasswordExpires = otpExpiry;
    await user.save();

    console.log('✅ Test OTP set:', resetOTP);
    console.log('✅ OTP expiry:', otpExpiry);

    // ✅ TESTING: Return success without actually sending email
    return res.status(200).json({
      success: true,
      message: 'Password reset OTP has been sent to your email. (Test mode: OTP is 123456)',
      data: {
        email,
        // For testing only - shows OTP in response
        otp: resetOTP,
        expiresAt: otpExpiry
      }
    });

  } catch (err) {
    console.error('❌ Forgot Password Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to process forgot password request',
      error: err.message
    });
  }
};

// Verify OTP and Reset Password
exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword, role } = req.body;

    console.log('========== RESET PASSWORD REQUEST ==========');
    console.log('Email:', email);
    console.log('OTP:', otp);
    console.log('Role:', role);

    // Validate input
    if (!email || !otp || !newPassword || !role) {
      return res.status(400).json({
        success: false,
        message: 'Email, OTP, new password, and role are required'
      });
    }

    // Validate password strength
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // Get the appropriate model
    const roleModelMap = require('../constants/roleModelMap');
    const Model = roleModelMap[role];

    if (!Model) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role specified'
      });
    }

    // Find user
    let user;
    if (role === 'AGENCY') {
      const { DeliveryAgency } = require('../models/DeliveryAgency');
      user = await DeliveryAgency.findOne({ 'agencyDetails.email': email });
    } else {
      user = await Model.findOne({ email });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // ✅ TESTING: Accept hardcoded OTP "123456" OR the stored OTP
    const isValidOTP = otp === "123456" || (user.resetPasswordOTP && user.resetPasswordOTP === otp);
    
    if (!isValidOTP) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP'
      });
    }

    // Check if OTP expired (skip check if using test OTP "123456")
    if (otp !== "123456" && user.resetPasswordExpires && new Date() > user.resetPasswordExpires) {
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new one.'
      });
    }

    console.log('✅ OTP verified successfully');

    // Update password
    user.password = newPassword;
    user.resetPasswordOTP = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    console.log('✅ Password updated successfully');

    return res.status(200).json({
      success: true,
      message: 'Password has been reset successfully. You can now login with your new password.'
    });

  } catch (err) {
    console.error('❌ Reset Password Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to reset password',
      error: err.message
    });
  }
};

// Toggle Customer Account Visibility
exports.toggleAccountVisibility = async (req, res) => {
  try {
    const { userId } = req.params;
    const { visibility } = req.body; // true / false

    if (visibility === undefined) {
      return res.status(400).json({
        success: false,
        message: 'visibility (true/false) is required'
      });
    }

    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.accountVisibility = visibility;
    await user.save();

    return res.status(200).json({
      success: true,
      message: `Account visibility turned ${visibility ? 'ON' : 'OFF'} successfully`,
      data: {
        userId: user._id,
        accountVisibility: user.accountVisibility
      }
    });

  } catch (err) {
    console.error('Toggle Account Visibility Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update account visibility',
      error: err.message
    });
  }
};